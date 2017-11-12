const DistortionsManager = window.DistortionsManager = {
  commonFileURLs: new Map(),
  
  valueToValueName: new Map(/*
    value: hash(valueName, graphIndex) (string)
  */),

  valueNameToTabMap: new Map(/*
    hash: <input type="radio"/>
  */),

  valueNameToRulesMap: new Map(/*
    hash: {
      "value": new DistortionRules(value, treeroot),
      "source": source code to generate value
      "proto": new DistortionRules(value.prototype, treeroot)
    }
  */),

  hashGraphAndValueNames: function(valueName, graphIndex) {
    return valueName + "-" + graphIndex;
  },

  getNameAndGraphIndex: function(hash) {
    let index = hash.lastIndexOf("-");
    let valueName = hash.substr(0, index);
    let graphIndex = parseInt(hash.substr(index + 1), 10);
    return [valueName, graphIndex];
  }
};

const DistortionsGUI = window.DistortionsGUI = {
  // private, see below
  iframeBox: null,
  treeUITemplate: null,
  propertyTreeTemplate: null,

  gridTreeCount: 0,

  buildValuePanel: function() {
    const valueName = AddValuePanel.form.nameOfValue.value,
          graphIndex = AddValuePanel.form.targetGraph.selectedIndex,
          hash = DistortionsManager.hashGraphAndValueNames(valueName, graphIndex);
    if (DistortionsManager.valueNameToTabMap.has(hash))
      return;

    let urlObject = new URL("blob/BlobLoader.html", window.location.href);
    {
      let scriptIter = DistortionsManager.commonFileURLs.values();
      let step = scriptIter.next();
      while (!step.done) {
        urlObject.searchParams.append("scriptblob", step.value);
        step = scriptIter.next();
      }
    }

    const valueFromSource = AddValuePanel.getValueEditor.getValue();

    {
      let sources = [
        "window.BlobLoader.getValue = ",
        valueFromSource
      ];
      let b = new Blob(sources, { type: "application/javascript" });
      urlObject.searchParams.append("scriptblob", URL.createObjectURL(b));
    }

    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", urlObject.href);

    const panel = document.createElement("section");
    panel.dataset.valueName = valueName;
    panel.dataset.graphIndex = graphIndex;
    panel.dataset.hash = hash;
    const radioClass = "valuepanel-" + DistortionsManager.valueNameToTabMap.size;
    panel.setAttribute("trapsTab", "value");

    const radio = OuterGridManager.insertValuePanel(
      graphIndex, valueName, radioClass, panel
    );
    DistortionsManager.valueNameToTabMap.set(hash, radio);

    iframe.addEventListener("load", function() {
      DistortionsGUI.finalizeValuePanel(
        iframe.contentWindow.BlobLoader,
        panel,
        valueFromSource
      );
      radio.click();
    }, {once: true, capture: true});
    this.iframeBox.appendChild(iframe);
  },

  finalizeValuePanel: function(BlobLoader, panel, valueFromSource) {
    var value;
    try {
      value = BlobLoader.getValueAndValidate();
    }
    catch (e) {
      BlobLoader.registerError(e);
      console.error(e);
    }
    if (BlobLoader.errorFired) {
      panel.classList.add("error");
      let strong = document.createElement("strong");
      strong.appendChild(document.createTextNode("Error: "));
      panel.appendChild(strong);
      panel.appendChild(document.createTextNode(BlobLoader.errorMessage));
    }
    else {
      const rules = this.buildDistortions(panel, value);
      DistortionsManager.valueNameToRulesMap.set(
        panel.dataset.hash, {
          "value": rules,
          "source": valueFromSource,
        }
      );
    }

    OuterGridManager.panels.appendChild(panel);

    if (typeof value === "function") {
      const hash = DistortionsManager.valueToValueName.get(value);
      const radio = DistortionsManager.valueNameToTabMap.get(hash);

      radio.dataset.valueIsFunction = true;
      const protoPanel = this.buildPrototypePanel(value, hash);
      if (protoPanel)
        OuterGridManager.insertOtherPanel(radio, protoPanel);

      /*
      let instancePanel = this.buildInstancePanel(value);
      if (instancePanel)
        OuterGridManager.insertOtherPanel(radio, instancePanel);
      */
    }
  },

  buildDistortions: function(panel, value) {
    // Build the GUI.
    const gridtree = this.treeUITemplate.content.firstElementChild.cloneNode(true);
    gridtree.setAttribute("id", "gridtree-" + this.gridTreeCount);
    this.gridTreeCount++;

    const treeroot = gridtree.getElementsByClassName("treeroot")[0];
    const rules = new DistortionsRules();
    rules.initByValue(value, treeroot);

    DistortionsManager.valueToValueName.set(value, panel.dataset.hash);

    styleAndMoveTreeColumns(gridtree);
    panel.appendChild(gridtree);

    return rules;
  },

  buildPrototypePanel: function(value, hash) {
    if (typeof value.prototype !== "object") {
      // Normally, this is never true... typeof Function.prototype == "function"
      return null;
    }

    const panel = document.createElement("section");
    panel.dataset.hash = hash;
    panel.setAttribute("trapsTab", "prototype");

    const rules = this.buildDistortions(panel, value.prototype);
    DistortionsManager.valueNameToRulesMap.get(hash).proto = rules;

    return panel;
  },

  metadataInGraphOrder: function() {
    const rv = [];
    if (!Array.isArray(OuterGridManager.graphNamesCache.items))
      return rv;

    for (let i = 0; i < OuterGridManager.graphNamesCache.items.length; i++)
      rv.push([]);

    const hashes = DistortionsManager.valueToValueName.values();
    let step;
    while ((step = hashes.next()) && !step.done) {
      let hash = step.value;
      const [
        valueName,
        graphIndex
      ] = DistortionsManager.getNameAndGraphIndex(hash);

      const data = {
        name: valueName,
        rules: {},
        hash: hash
      };

      const rulesMap = DistortionsManager.valueNameToRulesMap.get(hash);
      for (let prop in rulesMap) {
        if (rulesMap[prop] instanceof DistortionsRules)
          data.rules[prop] = rulesMap[prop].configurationAsJSON();
        else
          data.rules[prop] = rulesMap[prop];
      }

      rv[graphIndex].push(data);

      step = hashes.next();
    }

    return rv;
  }
};

{
  let elems = {
    "addValueForm": "grid-outer-addValue",
    "addValueTextarea": "grid-outer-addValue-valueReference",
    "iframeBox": "iframe-box",
    "treeUITemplate": "distortions-tree-ui-main",
    "propertyTreeTemplate": "distortions-tree-ui-property"
  };
  let keys = Reflect.ownKeys(elems);
  keys.forEach(function(key) {
    defineElementGetter(DistortionsGUI, key, elems[key]);
  });
}
