if (typeof _$ == 'undefined') {
    function _$(elementId) { return document.getElementById(elementId); }
}

/**
 * Creates a new column
 * @constructor
 * @class Represents a column in the editable grid
 * @param {Object} config
 */
function Column(config) {
    // default properties
    var props = {
        name: "",
        label: "",
        editable: true,
        renderable: true,
        datatype: "string",
        unit: null,
        precision: -1, // means that all decimals are displayed
        nansymbol: '',
        decimal_point: '.',
        thousands_separator: ',',
        unit_before_number: false,
        bar: true, // is the column to be displayed in a bar chart ? relevant only for numerical columns 
        hidden: false, // should the column be hidden by default
        headerRenderer: null,
        headerEditor: null,
        cellRenderer: null,
        cellEditor: null,
        cellValidators: [],
        enumProvider: null,
        optionValues: null,
        optionValuesForRender: null,
        columnIndex: -1
    };

    // override default properties with the ones given
    for (var p in props) this[p] = (typeof config == 'undefined' || typeof config[p] == 'undefined') ? props[p] : config[p];
}

Column.prototype.getOptionValuesForRender = function (rowIndex) {
    if (!this.enumProvider) {
        console.log('getOptionValuesForRender called on column ' + this.name + ' but there is no EnumProvider');
        return null;
    }
    var values = this.enumProvider.getOptionValuesForRender(this.editablegrid, this, rowIndex);
    return values ? values : this.optionValuesForRender;
};

Column.prototype.getOptionValuesForEdit = function (rowIndex) {
    if (!this.enumProvider) {
        console.log('getOptionValuesForEdit called on column ' + this.name + ' but there is no EnumProvider');
        return null;
    }
    var values = this.enumProvider.getOptionValuesForEdit(this.editablegrid, this, rowIndex);
    return values ? this.editablegrid._convertOptions(values) : this.optionValues;
};

Column.prototype.isValid = function (value) {
    for (var i = 0; i < this.cellValidators.length; i++) if (!this.cellValidators[i].isValid(value)) return false;
    return true;
};

Column.prototype.isNumerical = function () {
    return this.datatype == 'double' || this.datatype == 'integer';
};

/**
 * Creates a new enumeration provider 
 * @constructor
 * @class Base class for all enumeration providers
 * @param {Object} config
 */
function EnumProvider(config) {
    // default properties
    this.getOptionValuesForRender = function (grid, column, rowIndex) { return null; };
    this.getOptionValuesForEdit = function (grid, column, rowIndex) { return null; };

    // override default properties with the ones given
    for (var p in config) this[p] = config[p];
}

/**
 * Creates a new EditableGrid.
 * <p>You can specify here some configuration options (optional).
 * <br/>You can also set these same configuration options afterwards.
 * <p>These options are:
 * <ul>
 * <li>enableSort: enable sorting when clicking on column headers (default=true)</li>
 * <li>doubleclick: use double click to edit cells (default=false)</li>
 * <li>editmode: can be one of
 * <ul>
 * 		<li>absolute: cell editor comes over the cell (default)</li>
 * 		<li>static: cell editor comes inside the cell</li>
 * 		<li>fixed: cell editor comes in an external div</li>
 * </ul>
 * </li>
 * <li>editorzoneid: used only when editmode is set to fixed, it is the id of the div to use for cell editors</li>
 * <li>allowSimultaneousEdition: tells if several cells can be edited at the same time (default=false)<br/>
 * Warning: on some Linux browsers (eg. Epiphany), a blur event is sent when the user clicks on a 'select' input to expand it.
 * So practically, in these browsers you should set allowSimultaneousEdition to true if you want to use columns with option values and/or enum providers.
 * This also used to happen in older versions of Google Chrome Linux but it has been fixed, so upgrade if needed.</li>
 * <li>saveOnBlur: should be cells saved when clicking elsewhere ? (default=true)</li>
 * <li>invalidClassName: CSS class to apply to text fields when the entered value is invalid (default="invalid")</li>
 * <li>ignoreLastRow: ignore last row when sorting and charting the data (typically for a 'total' row)</li>
 * <li>caption: text to use as the grid's caption</li>
 * <li>dateFormat: EU or US (default="EU")</li>
 * <li>shortMonthNames: list of month names (default=["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])</li>
 * <li>smartColorsBar: colors used for rendering (stacked) bar charts</li>
 * <li>smartColorsPie: colors used for rendering pie charts</li>
 * <li>pageSize: maximum number of rows displayed (0 means we don't want any pagination, which is the default)</li>
 * <li>sortIconDown: icon used to show desc order</li>
 * <li>sortIconUp:  icon used to show asc order</li>
 * </ul>
 * @constructor
 * @class EditableGrid
 */
function EditableGrid(name, config) {
    if (typeof name != 'undefined' && name.replace(/\s+/g, '') == "") console.error("EditableGrid() : parameter [name] cannot be empty.");
    if (name) this.init(name, config);
}

/**
 * Default properties
 */
EditableGrid.prototype.enableSort = true;
EditableGrid.prototype.enableStore = true;
EditableGrid.prototype.doubleclick = false;
EditableGrid.prototype.editmode = "absolute";
EditableGrid.prototype.editorzoneid = "";
EditableGrid.prototype.allowSimultaneousEdition = false;
EditableGrid.prototype.saveOnBlur = true;
EditableGrid.prototype.invalidClassName = "invalid";
EditableGrid.prototype.ignoreLastRow = false;
EditableGrid.prototype.caption = null;
EditableGrid.prototype.dateFormat = "EU";
EditableGrid.prototype.shortMonthNames = null;
EditableGrid.prototype.smartColorsBar = ["#dc243c", "#4040f6", "#00f629", "#efe100", "#f93fb1", "#6f8183", "#111111"];
EditableGrid.prototype.smartColorsPie = ["#FF0000", "#00FF00", "#0000FF", "#FFD700", "#FF00FF", "#00FFFF", "#800080"];
EditableGrid.prototype.pageSize = 0; // client-side pagination, don't set this for server-side pagination!

//server-side pagination, sorting and filtering
EditableGrid.prototype.serverSide = false;
EditableGrid.prototype.pageCount = 0;
EditableGrid.prototype.totalRowCount = 0;
EditableGrid.prototype.unfilteredRowCount = 0;
EditableGrid.prototype.paginatorAttributes = null;
EditableGrid.prototype.lastURL = null;

EditableGrid.prototype.init = function (name, config) {
    if (typeof name != "string" || (typeof config != "object" && typeof config != "undefined")) {
        alert("The EditableGrid constructor takes two arguments:\n- name (string)\n- config (object)\n\nGot instead " + (typeof name) + " and " + (typeof config) + ".");
    };

    // override default properties with the ones given
    if (typeof config != 'undefined') for (var p in config) this[p] = config[p];

    this.Browser = {
        IE: !!(window.attachEvent && navigator.userAgent.indexOf('Opera') === -1),
        Opera: navigator.userAgent.indexOf('Opera') > -1,
        WebKit: navigator.userAgent.indexOf('AppleWebKit/') > -1,
        Gecko: navigator.userAgent.indexOf('Gecko') > -1 && navigator.userAgent.indexOf('KHTML') === -1,
        MobileSafari: !!navigator.userAgent.match(/Apple.*Mobile.*Safari/)
    };

    if (typeof this.detectDir != 'function') {
        var error = new Error();
        alert("Who is calling me now ? " + error.stack);
    }

    // private data
    this.name = name;
    this.columns = [];
    this.data = [];
    this.dataUnfiltered = null; // non null means that data is filtered
    this.xmlDoc = null;
    this.sortedColumnName = -1;
    this.sortDescending = false;
    this.baseUrl = this.detectDir();
    this.nbHeaderRows = 1;
    this.lastSelectedRowIndex = -1;
    this.currentPageIndex = 0;
    this.currentFilter = null;
    this.currentContainerid = null;
    this.currentClassName = null;
    this.currentTableid = null;

    if (this.enableSort) {
        if (typeof config != "undefined" && typeof config['sortIconUp'] != "undefined") {
            this.sortUpElement = new Image();
            this.sortUpElement.src = config['sortIconUp'];
        } else {
            this.sortUpElement = document.createElement('span');
            this.sortUpElement.innerHTML = '&#8593;' // Unicode 'up' arrow
        }

        if (typeof config != "undefined" && typeof config['sortIconDown'] != "undefined") {
            this.sortDownElement = new Image();
            this.sortDownElement.src = config['sortIconDown'];
        } else {
            this.sortDownElement = document.createElement('span');
            this.sortDownElement.innerHTML = '&#8595;' // Unicode 'down' arrow
        }
    }

    // restore stored parameters, or use default values if nothing stored
    this.currentPageIndex = this.localisset('pageIndex') ? parseInt(this.localget('pageIndex')) : 0;
    this.sortedColumnName = this.localisset('sortColumnIndexOrName') ? this.localget('sortColumnIndexOrName') : -1;
    this.sortDescending = this.localisset('sortColumnIndexOrName') && this.localisset('sortDescending') ? this.localget('sortDescending') == 'true' : false;
    this.currentFilter = this.localisset('filter') ? this.localget('filter') : null;
};

/**
 * Callback functions
 */

EditableGrid.prototype.tableLoaded = function () { };
EditableGrid.prototype.chartRendered = function () { };
EditableGrid.prototype.tableRendered = function (containerid, className, tableid) { };
EditableGrid.prototype.tableSorted = function (columnIndex, descending) { };
EditableGrid.prototype.tableFiltered = function () { };
EditableGrid.prototype.openedCellEditor = function (rowIndex, columnIndex) { };
EditableGrid.prototype.modelChanged = function (rowIndex, columnIndex, oldValue, newValue, row) { };
EditableGrid.prototype.rowSelected = function (oldRowIndex, newRowIndex) { };
EditableGrid.prototype.isHeaderEditable = function (rowIndex, columnIndex) { return false; };
EditableGrid.prototype.isEditable = function (rowIndex, columnIndex) { return true; };
EditableGrid.prototype.readonlyWarning = function () { };
/** Notifies that a row has been deleted */
EditableGrid.prototype.rowRemoved = function (oldRowIndex, rowId) { };

//indicates that an editor was blurred
EditableGrid.prototype.editorBlurred = function (rowIndex, columnIndex, element) { };

//indicates that an editor was cancelled, will allow for task to be deleted
EditableGrid.prototype.editorCancelled = function (rowIndex, columnIndex, element) { };

/**
 * Load metadata and/or data from an XML url
 * The callback "tableLoaded" is called when loading is complete.
 */
EditableGrid.prototype.loadXML = function (url, callback, dataOnly) {
    this.lastURL = url;
    var self = this;

    // IE
    if (window.ActiveXObject) {
        this.xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
        this.xmlDoc.onreadystatechange = function () {
            if (self.xmlDoc.readyState == 4) {
                self.processXML();
                self._callback('xml', callback);
            }
        };
        this.xmlDoc.load(this._addUrlParameters(url, dataOnly));
    }

    // generic Ajax
    else if (window.XMLHttpRequest) {
        this.xmlDoc = new XMLHttpRequest();
        this.xmlDoc.onreadystatechange = function () {
            if (this.readyState == 4) {
                self.xmlDoc = this.responseXML;
                if (!self.xmlDoc) { console.error("Could not load XML from url '" + url + "'"); return false; }
                self.processXML();
                self._callback('xml', callback);
            }
        };
        this.xmlDoc.open("GET", this._addUrlParameters(url, dataOnly), true);
        this.xmlDoc.send("");
    }

    // Firefox (and some other browsers) 
    else if (document.implementation && document.implementation.createDocument) {
        this.xmlDoc = document.implementation.createDocument("", "", null);
        this.xmlDoc.onload = function () {
            self.processXML();
            self._callback('xml', callback);
        };
        this.xmlDoc.load(this._addUrlParameters(url, dataOnly));
    }

    // should never happen
    else {
        alert("Cannot load a XML url with this browser!");
        return false;
    }

    return true;
};

/**
 * Load metadata and/or data from an XML string
 * No callback "tableLoaded" is called since this is a synchronous operation.
 * 
 * Contributed by Tim Consolazio of Tcoz Tech Services, tcoz@tcoz.com
 * http://tcoztechwire.blogspot.com/2012/04/setxmlfromstring-extension-for.html
 */
EditableGrid.prototype.loadXMLFromString = function (xml) {
    if (window.DOMParser) {
        var parser = new DOMParser();
        this.xmlDoc = parser.parseFromString(xml, "application/xml");
    }
    else {
        this.xmlDoc = new ActiveXObject("Microsoft.XMLDOM"); // IE
        this.xmlDoc.async = "false";
        this.xmlDoc.loadXML(xml);
    }

    this.processXML();
};

/**
 * Process the XML content
 * @private
 */
EditableGrid.prototype.processXML = function () {
    with (this) {

        // clear model and pointer to current table
        this.data = [];
        this.dataUnfiltered = null;
        this.table = null;

        // load metadata (only one tag <metadata> --> metadata[0])
        var metadata = xmlDoc.getElementsByTagName("metadata");
        if (metadata && metadata.length >= 1) {

            this.columns = [];
            var columnDeclarations = metadata[0].getElementsByTagName("column");
            for (var i = 0; i < columnDeclarations.length; i++) {

                // get column type
                var col = columnDeclarations[i];
                var datatype = col.getAttribute("datatype");

                // get enumerated values if any
                var optionValuesForRender = null;
                var optionValues = null;
                var enumValues = col.getElementsByTagName("values");
                if (enumValues.length > 0) {
                    optionValues = [];
                    optionValuesForRender = {};

                    var enumGroups = enumValues[0].getElementsByTagName("group");
                    if (enumGroups.length > 0) {
                        for (var g = 0; g < enumGroups.length; g++) {
                            var groupOptionValues = [];
                            enumValues = enumGroups[g].getElementsByTagName("value");
                            for (var v = 0; v < enumValues.length; v++) {
                                var _value = enumValues[v].getAttribute("value");
                                var _label = enumValues[v].firstChild ? enumValues[v].firstChild.nodeValue : "";
                                optionValuesForRender[_value] = _label;
                                groupOptionValues.push({ value: _value, label: _label });
                            }
                            optionValues.push({ label: enumGroups[g].getAttribute("label"), values: groupOptionValues });
                        }
                    }
                    else {
                        enumValues = enumValues[0].getElementsByTagName("value");
                        for (var v = 0; v < enumValues.length; v++) {
                            var _value = enumValues[v].getAttribute("value");
                            var _label = enumValues[v].firstChild ? enumValues[v].firstChild.nodeValue : "";
                            optionValuesForRender[_value] = _label;
                            optionValues.push({ value: _value, label: _label });
                        }
                    }
                }

                // create new column           
                columns.push(new Column({
                    name: col.getAttribute("name"),
                    label: (typeof col.getAttribute("label") == 'string' ? col.getAttribute("label") : col.getAttribute("name")),
                    datatype: (col.getAttribute("datatype") ? col.getAttribute("datatype") : "string"),
                    editable: col.getAttribute("editable") == "true",
                    bar: (col.getAttribute("bar") ? col.getAttribute("bar") == "true" : true),
                    hidden: (col.getAttribute("hidden") ? col.getAttribute("hidden") == "true" : false),
                    optionValuesForRender: optionValuesForRender,
                    optionValues: optionValues
                }));
            }

            // process columns
            processColumns();
        }

        // load server-side pagination data
        var paginator = xmlDoc.getElementsByTagName("paginator");
        if (paginator && paginator.length >= 1) {
            this.paginatorAttributes = null; // TODO: paginator[0].getAllAttributesAsPOJO;
            this.pageCount = paginator[0].getAttribute('pagecount');
            this.totalRowCount = paginator[0].getAttribute('totalrowcount');
            this.unfilteredRowCount = paginator[0].getAttribute('unfilteredrowcount');
        }

        // if no row id is provided, we create one since we need one
        var defaultRowId = 1;

        // load content
        var rows = xmlDoc.getElementsByTagName("row");
        for (var i = 0; i < rows.length; i++) {
            // get all defined cell values
            var cellValues = {};
            var cols = rows[i].getElementsByTagName("column");
            for (var j = 0; j < cols.length; j++) {
                var colname = cols[j].getAttribute("name");
                if (!colname) {
                    if (j >= columns.length) console.error("You defined too many columns for row " + (i + 1));
                    else colname = columns[j].name;
                }
                cellValues[colname] = cols[j].firstChild ? cols[j].firstChild.nodeValue : "";
            }

            // for each row we keep the orginal index, the id and all other attributes that may have been set in the XML
            var rowData = { visible: true, originalIndex: i, id: rows[i].getAttribute("id") !== null ? rows[i].getAttribute("id") : defaultRowId++ };
            for (var attrIndex = 0; attrIndex < rows[i].attributes.length; attrIndex++) {
                var node = rows[i].attributes.item(attrIndex);
                if (node.nodeName != "id") rowData[node.nodeName] = node.nodeValue;
            }

            // get column values for this rows
            rowData.columns = [];
            for (var c = 0; c < columns.length; c++) {
                var cellValue = columns[c].name in cellValues ? cellValues[columns[c].name] : "";
                rowData.columns.push(getTypedValue(c, cellValue));
            }

            // add row data in our model
            data.push(rowData);
        }
    }

    return true;
};

/**
 * Load metadata and/or data from a JSON url
 * The callback "tableLoaded" is called when loading is complete.
 */
EditableGrid.prototype.loadJSON = function (url, callback, dataOnly) {
    this.lastURL = url;
    var self = this;

    // should never happen
    if (!window.XMLHttpRequest) {
        alert("Cannot load a JSON url with this browser!");
        return false;
    }

    var ajaxRequest = new XMLHttpRequest();
    ajaxRequest.onreadystatechange = function () {
        if (this.readyState == 4) {
            if (!this.responseText) { console.error("Could not load JSON from url '" + url + "'"); return false; }
            if (!self.processJSON(this.responseText)) { console.error("Invalid JSON data obtained from url '" + url + "'"); return false; }
            self._callback('json', callback);
        }
    };

    ajaxRequest.open("GET", this._addUrlParameters(url, dataOnly), true);
    ajaxRequest.send("");

    return true;
};

EditableGrid.prototype._addUrlParameters = function (baseUrl, dataOnly) {
    // we add a dummy timestamp parameter to avoid getting an old version from the browser's cache
    var sep = baseUrl.indexOf('?') >= 0 ? '&' : '?';
    baseUrl += sep + (new Date().getTime());

    if (!this.serverSide) return baseUrl;

    // add pagination, filtering and sorting parameters to the base url
    return baseUrl
        + "&page=" + (this.currentPageIndex + 1)
        + "&filter=" + (this.currentFilter ? encodeURIComponent(this.currentFilter) : "")
        + "&sort=" + (this.sortedColumnName && this.sortedColumnName != -1 ? encodeURIComponent(this.sortedColumnName) : "")
        + "&asc=" + (this.sortDescending ? 0 : 1)
        + (dataOnly ? '&data_only=1' : '');
};

EditableGrid.prototype._callback = function (type, callback) {
    if (callback) callback.call(this);
    else {

        if (this.serverSide) {

            // deferred refreshGrid: first load the updated data from the server then call the original refreshGrid
            this.refreshGrid = function (baseUrl) {
                var callback = function () { EditableGrid.prototype.refreshGrid.call(this); };
                var load = type == 'xml' ? this.loadXML : this.loadJSON;
                load.call(this, baseUrl || this.lastURL, callback, true);
            };
        }

        this.tableLoaded();
    }
};

/**
 * Load metadata and/or data from a JSON string
 * No callback "tableLoaded" is called since this is a synchronous operation.
 */
EditableGrid.prototype.loadJSONFromString = function (json) {
    return this.processJSON(json);
};

/**
 * Load metadata and/or data from a Javascript object
 * No callback "tableLoaded" is called since this is a synchronous operation.
 */
EditableGrid.prototype.load = function (object) {
    return this.processJSON(object);
};

/**
 * Update and render data for given rows from a Javascript object
 */
EditableGrid.prototype.update = function (object) {
    if (object.data) for (var i = 0; i < object.data.length; i++) {
        var row = object.data[i];
        if (!row.id || !row.values) continue;

        // get row to update in our model
        var rowIndex = this.getRowIndex(row.id);
        var rowData = this.data[rowIndex];

        // row values can be given as an array (same order as columns) or as an object (associative array)
        if (Object.prototype.toString.call(row.values) !== '[object Array]') cellValues = row.values;
        else {
            cellValues = {};
            for (var j = 0; j < row.values.length && j < this.columns.length; j++) cellValues[this.columns[j].name] = row.values[j];
        }

        // set all attributes that may have been set in the JSON
        for (var attributeName in row) if (attributeName != "id" && attributeName != "values") rowData[attributeName] = row[attributeName];

        // get column values for this rows
        rowData.columns = [];
        for (var c = 0; c < this.columns.length; c++) {
            var cellValue = this.columns[c].name in cellValues ? cellValues[this.columns[c].name] : "";
            rowData.columns.push(this.getTypedValue(c, cellValue));
        }

        // render row
        var tr = this.getRow(rowIndex);
        for (var j = 0; j < tr.cells.length && j < this.columns.length; j++)  if (this.columns[j].renderable) this.columns[j].cellRenderer._render(rowIndex, j, tr.cells[j], this.getValueAt(rowIndex, j));
        this.tableRendered(this.currentContainerid, this.currentClassName, this.currentTableid);
    }
};

/**
 * Process the JSON content
 * @private
 */
EditableGrid.prototype.processJSON = function (jsonData) {
    if (typeof jsonData == "string") jsonData = eval("(" + jsonData + ")");
    if (!jsonData) return false;

    // clear model and pointer to current table
    this.data = [];

    var _ = require("lodash");
    this.rawData = _.keyBy(jsonData.data, function (item) {
        return item.id
    });
    rawData = this.rawData
    jsData = jsonData;

    this.dataUnfiltered = null;
    this.table = null;

    // load metadata
    if (jsonData.metadata) {

        // create columns 
        this.columns = [];
        for (var c = 0; c < jsonData.metadata.length; c++) {
            var columndata = jsonData.metadata[c];

            var optionValues = columndata.values ? this._convertOptions(columndata.values) : null;
            var optionValuesForRender = null;
            if (optionValues) {

                // build a fast lookup structure for rendering
                var optionValuesForRender = {};
                for (var optionIndex = 0; optionIndex < optionValues.length; optionIndex++) {
                    var optionValue = optionValues[optionIndex];
                    if (typeof optionValue.values == 'object') {
                        for (var groupOptionIndex = 0; groupOptionIndex < optionValue.values.length; groupOptionIndex++) {
                            var groupOptionValue = optionValue.values[groupOptionIndex];
                            optionValuesForRender[groupOptionValue.value] = groupOptionValue.label;
                        }
                    }
                    else optionValuesForRender[optionValue.value] = optionValue.label;
                }
            }

            this.columns.push(new Column({
                name: columndata.name,
                label: (columndata.label ? columndata.label : columndata.name),
                datatype: (columndata.datatype ? columndata.datatype : "string"),
                editable: (columndata.editable ? true : false),
                bar: (typeof columndata.bar == 'undefined' ? true : (columndata.bar || false)),
                hidden: (typeof columndata.hidden == 'undefined' ? false : (columndata.hidden ? true : false)),
                optionValuesForRender: optionValuesForRender,
                optionValues: optionValues
            }));
        }

        // process columns
        this.processColumns();
    }

    // load server-side pagination data
    if (jsonData.paginator) {
        this.paginatorAttributes = jsonData.paginator;
        this.pageCount = jsonData.paginator.pagecount;
        this.totalRowCount = jsonData.paginator.totalrowcount;
        this.unfilteredRowCount = jsonData.paginator.unfilteredrowcount;
    }

    // if no row id is provided, we create one since we need one
    var defaultRowId = 1;

    // load content
    if (jsonData.data) for (var i = 0; i < jsonData.data.length; i++) {
        var row = jsonData.data[i];
        if (!row.values) continue;

        // row values can be given as an array (same order as columns) or as an object (associative array)
        if (Object.prototype.toString.call(row.values) !== '[object Array]') cellValues = row.values;
        else {
            cellValues = {};
            for (var j = 0; j < row.values.length && j < this.columns.length; j++) cellValues[this.columns[j].name] = row.values[j];
        }

        // for each row we keep the orginal index, the id and all other attributes that may have been set in the JSON
        var rowData = { visible: true, originalIndex: i, id: row.id !== undefined && row.id !== null ? row.id : defaultRowId++ };
        for (var attributeName in row) if (attributeName != "id" && attributeName != "values") rowData[attributeName] = row[attributeName];

        // get column values for this rows
        rowData.columns = [];
        for (var c = 0; c < this.columns.length; c++) {
            var cellValue = this.columns[c].name in cellValues ? cellValues[this.columns[c].name] : "";
            rowData.columns.push(this.getTypedValue(c, cellValue));
        }

        // add row data in our model
        this.data.push(rowData);
    }

    return true;
};

/**
 * Process columns
 * @private
 */
EditableGrid.prototype.processColumns = function () {
    for (var columnIndex = 0; columnIndex < this.columns.length; columnIndex++) {

        var column = this.columns[columnIndex];

        // set column index and back pointer
        column.columnIndex = columnIndex;
        column.editablegrid = this;

        // parse column type
        this.parseColumnType(column);

        // create suited enum provider if none given
        if (!column.enumProvider) column.enumProvider = column.optionValues ? new EnumProvider() : null;

        // create suited cell renderer if none given
        if (!column.cellRenderer) this._createCellRenderer(column);
        if (!column.headerRenderer) this._createHeaderRenderer(column);

        // create suited cell editor if none given
        if (!column.cellEditor) this._createCellEditor(column);
        if (!column.headerEditor) this._createHeaderEditor(column);

        // add default cell validators based on the column type
        this._addDefaultCellValidators(column);
    }
};

/**
 * Parse column type
 * @private
 */

EditableGrid.prototype.parseColumnType = function (column) {
    // reset
    column.unit = null;
    column.precision = -1;
    column.decimal_point = '.';
    column.thousands_separator = ',';
    column.unit_before_number = false;
    column.nansymbol = '';

    // extract precision, unit and number format from type if 6 given
    if (column.datatype.match(/(.*)\((.*),(.*),(.*),(.*),(.*),(.*)\)$/)) {
        column.datatype = RegExp.$1;
        column.unit = RegExp.$2;
        column.precision = parseInt(RegExp.$3);
        column.decimal_point = RegExp.$4;
        column.thousands_separator = RegExp.$5;
        column.unit_before_number = RegExp.$6;
        column.nansymbol = RegExp.$7;

        // trim should be done after fetching RegExp matches beacuse it itself uses a RegExp and causes interferences!
        column.unit = column.unit.trim();
        column.decimal_point = column.decimal_point.trim();
        column.thousands_separator = column.thousands_separator.trim();
        column.unit_before_number = column.unit_before_number.trim() == '1';
        column.nansymbol = column.nansymbol.trim();
    }

    // extract precision, unit and number format from type if 5 given
    else if (column.datatype.match(/(.*)\((.*),(.*),(.*),(.*),(.*)\)$/)) {
        column.datatype = RegExp.$1;
        column.unit = RegExp.$2;
        column.precision = parseInt(RegExp.$3);
        column.decimal_point = RegExp.$4;
        column.thousands_separator = RegExp.$5;
        column.unit_before_number = RegExp.$6;

        // trim should be done after fetching RegExp matches beacuse it itself uses a RegExp and causes interferences!
        column.unit = column.unit.trim();
        column.decimal_point = column.decimal_point.trim();
        column.thousands_separator = column.thousands_separator.trim();
        column.unit_before_number = column.unit_before_number.trim() == '1';
    }

    // extract precision, unit and nansymbol from type if 3 given
    else if (column.datatype.match(/(.*)\((.*),(.*),(.*)\)$/)) {
        column.datatype = RegExp.$1;
        column.unit = RegExp.$2.trim();
        column.precision = parseInt(RegExp.$3);
        column.nansymbol = RegExp.$4.trim();
    }

    // extract precision and unit from type if two given
    else if (column.datatype.match(/(.*)\((.*),(.*)\)$/)) {
        column.datatype = RegExp.$1.trim();
        column.unit = RegExp.$2.trim();
        column.precision = parseInt(RegExp.$3);
    }

    // extract precision or unit from type if any given
    else if (column.datatype.match(/(.*)\((.*)\)$/)) {
        column.datatype = RegExp.$1.trim();
        var unit_or_precision = RegExp.$2.trim();
        if (unit_or_precision.match(/^[0-9]*$/)) column.precision = parseInt(unit_or_precision);
        else column.unit = unit_or_precision;
    }

    if (column.decimal_point == 'comma') column.decimal_point = ',';
    if (column.decimal_point == 'dot') column.decimal_point = '.';
    if (column.thousands_separator == 'comma') column.thousands_separator = ',';
    if (column.thousands_separator == 'dot') column.thousands_separator = '.';

    if (isNaN(column.precision)) column.precision = -1;
    if (column.unit == '') column.unit = null;
    if (column.nansymbol == '') column.nansymbol = null;
};

/**
 * Get typed value
 * @private
 */

EditableGrid.prototype.getTypedValue = function (columnIndex, cellValue) {
    if (cellValue === null) return cellValue;

    var colType = this.getColumnType(columnIndex);
    if (colType == 'boolean') cellValue = (cellValue && cellValue != 0 && cellValue != "false" && cellValue != "f") ? true : false;
    if (colType == 'integer') { cellValue = parseInt(cellValue, 10); }
    if (colType == 'double') { cellValue = parseFloat(cellValue); }
    if (colType == 'string') { cellValue = "" + cellValue; }

    return cellValue;
};

/**
 * Attach to an existing HTML table.
 * The second parameter can be used to give the column definitions.
 * This parameter is left for compatibility, but is deprecated: you should now use "load" to setup the metadata.
 */
EditableGrid.prototype.attachToHTMLTable = function (_table, _columns) {
    // clear model and pointer to current table
    this.data = [];
    this.dataUnfiltered = null;
    this.table = null;

    // process columns if given
    if (_columns) {
        this.columns = _columns;
        for (var columnIndex = 0; columnIndex < this.columns.length; columnIndex++) this.columns[columnIndex].optionValues = this._convertOptions(this.columns[columnIndex].optionValues); // convert options from old format if needed
        this.processColumns();
    }

    // get pointers to table components
    this.table = typeof _table == 'string' ? _$(_table) : _table;
    if (!this.table) console.error("Invalid table given: " + _table);
    this.tHead = this.table.tHead;
    this.tBody = this.table.tBodies[0];

    // create table body if needed
    if (!this.tBody) {
        this.tBody = document.createElement("TBODY");
        this.table.insertBefore(this.tBody, this.table.firstChild);
    }

    // create table header if needed
    if (!this.tHead) {
        this.tHead = document.createElement("THEAD");
        this.table.insertBefore(this.tHead, this.tBody);
    }

    // if header is empty use first body row as header
    if (this.tHead.rows.length == 0 && this.tBody.rows.length > 0)
        this.tHead.appendChild(this.tBody.rows[0]);

    // get number of rows in header
    this.nbHeaderRows = this.tHead.rows.length;

    // load header labels
    var rows = this.tHead.rows;
    for (var i = 0; i < rows.length; i++) {
        var cols = rows[i].cells;
        var columnIndexInModel = 0;
        for (var j = 0; j < cols.length && columnIndexInModel < this.columns.length; j++) {
            if (!this.columns[columnIndexInModel].label || this.columns[columnIndexInModel].label == this.columns[columnIndexInModel].name) this.columns[columnIndexInModel].label = cols[j].innerHTML;
            var colspan = parseInt(cols[j].getAttribute("colspan"));
            columnIndexInModel += colspan > 1 ? colspan : 1;
        }
    }

    // load content
    var rows = this.tBody.rows;
    for (var i = 0; i < rows.length; i++) {
        var rowData = [];
        var cols = rows[i].cells;
        for (var j = 0; j < cols.length && j < this.columns.length; j++) rowData.push(this.getTypedValue(j, cols[j].innerHTML));
        this.data.push({ visible: true, originalIndex: i, id: rows[i].id, columns: rowData });
        rows[i].rowId = rows[i].id;
        rows[i].id = this._getRowDOMId(rows[i].id);
    }
};

/**
 * Creates a suitable cell renderer for the column
 * @private
 */
EditableGrid.prototype._createCellRenderer = function (column) {
    column.cellRenderer =
        column.enumProvider && column.datatype == "list" && typeof MultiselectCellRenderer != 'undefined' ? new MultiselectCellRenderer() :
            column.enumProvider ? new EnumCellRenderer() :
                column.datatype == "integer" || column.datatype == "double" ? new NumberCellRenderer() :
                    column.datatype == "boolean" ? new CheckboxCellRenderer() :
                        column.datatype == "email" ? new EmailCellRenderer() :
                            column.datatype == "website" || column.datatype == "url" ? new WebsiteCellRenderer() :
                                column.datatype == "date" ? new DateCellRenderer() :
                                    column.datatype == "hashtag" ? new HashtagCellRenderer() :
                                        column.datatype == "action" ? new ActionCellRenderer() :
                                            column.datatype == "array" ? new ArrayCellRenderer() :
                                                new CellRenderer();

    // give access to the column from the cell renderer
    if (column.cellRenderer) {
        column.cellRenderer.editablegrid = this;
        column.cellRenderer.column = column;
    }
};

/**
 * Creates a suitable header cell renderer for the column
 * @private
 */
EditableGrid.prototype._createHeaderRenderer = function (column) {
    column.headerRenderer = (this.enableSort && column.datatype != "html") ? new SortHeaderRenderer(column.name) : new CellRenderer();

    // give access to the column from the header cell renderer
    if (column.headerRenderer) {
        column.headerRenderer.editablegrid = this;
        column.headerRenderer.column = column;
    }
};

/**
 * Creates a suitable cell editor for the column
 * @private
 */
EditableGrid.prototype._createCellEditor = function (column) {
    column.cellEditor =
        column.enumProvider && column.datatype == "list" && typeof MultiselectCellEditor != 'undefined' ? new MultiselectCellEditor() :
            column.enumProvider ? new SelectCellEditor() :
                column.datatype == "integer" || column.datatype == "double" ? new NumberCellEditor(column.datatype) :
                    column.datatype == "boolean" ? null :
                        column.datatype == "email" ? new TextCellEditor(column.precision) :
                            column.datatype == "array" ? new ArrayCellEditor() :
                                column.datatype == "website" || column.datatype == "url" ? new TextCellEditor(column.precision) :
                                    column.datatype == "date" ? (typeof jQuery == 'undefined' || typeof jQuery.datepicker == 'undefined' ? new TextCellEditor(column.precision, 10) : new DateCellEditor({ fieldSize: column.precision, maxLength: 10 })) :
                                        new TextCellEditor(column.precision);

    // give access to the column from the cell editor
    if (column.cellEditor) {
        column.cellEditor.editablegrid = this;
        column.cellEditor.column = column;
    }


};

/**
 * Creates a suitable header cell editor for the column
 * @private
 */
EditableGrid.prototype._createHeaderEditor = function (column) {
    column.headerEditor = new TextCellEditor();

    // give access to the column from the cell editor
    if (column.headerEditor) {
        column.headerEditor.editablegrid = this;
        column.headerEditor.column = column;
    }
};

/**
 * Returns the number of rows
 */
EditableGrid.prototype.getRowCount = function () {
    return this.data.length;
};

/**
 * Returns the number of rows, not taking the filter into account if any
 */
EditableGrid.prototype.getUnfilteredRowCount = function () {
    // given if server-side filtering is involved
    if (this.unfilteredRowCount > 0) return this.unfilteredRowCount;

    var _data = this.dataUnfiltered == null ? this.data : this.dataUnfiltered;
    return _data.length;
};

/**
 * Returns the number of rows in all pages
 */
EditableGrid.prototype.getTotalRowCount = function () {
    // different from getRowCount only is server-side pagination is involved
    if (this.totalRowCount > 0) return this.totalRowCount;

    return this.getRowCount();
};

/**
 * Returns the number of columns
 */
EditableGrid.prototype.getColumnCount = function () {
    return this.columns.length;
};

/**
 * Returns true if the column exists
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.hasColumn = function (columnIndexOrName) {
    return this.getColumnIndex(columnIndexOrName) >= 0;
};

/**
 * Returns the column
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.getColumn = function (columnIndexOrName) {
    var colIndex = this.getColumnIndex(columnIndexOrName);
    if (colIndex < 0) { console.error("[getColumn] Column not found with index or name " + columnIndexOrName); return null; }
    return this.columns[colIndex];
};

/**
 * Returns the name of a column
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.getColumnName = function (columnIndexOrName) {
    return this.getColumn(columnIndexOrName).name;
};

/**
 * Returns the label of a column
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.getColumnLabel = function (columnIndexOrName) {
    return this.getColumn(columnIndexOrName).label;
};

/**
 * Returns the type of a column
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.getColumnType = function (columnIndexOrName) {
    return this.getColumn(columnIndexOrName).datatype;
};

/**
 * Returns the unit of a column
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.getColumnUnit = function (columnIndexOrName) {
    return this.getColumn(columnIndexOrName).unit;
};

/**
 * Returns the precision of a column
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.getColumnPrecision = function (columnIndexOrName) {
    return this.getColumn(columnIndexOrName).precision;
};

/**
 * Returns true if the column is to be displayed in a bar chart
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.isColumnBar = function (columnIndexOrName) {
    var column = this.getColumn(columnIndexOrName);
    return (column.bar && column.isNumerical());
};

/**
 * Returns the stack of a column (for stacked bar charts)
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.getColumnStack = function (columnIndexOrName) {
    var column = this.getColumn(columnIndexOrName);
    return column.isNumerical() ? column.bar : '';
};


/**
 * Returns true if the column is numerical (double or integer)
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.isColumnNumerical = function (columnIndexOrName) {
    var column = this.getColumn(columnIndexOrName);
    return column.isNumerical();;
};

/**
 * Returns the value at the specified index
 * @param {Integer} rowIndex
 * @param {Integer} columnIndex
 */
EditableGrid.prototype.getValueAt = function (rowIndex, columnIndex) {
    // check and get column
    if (columnIndex < 0 || columnIndex >= this.columns.length) { console.error("[getValueAt] Invalid column index " + columnIndex); return null; }
    var column = this.columns[columnIndex];

    // get value in model
    if (rowIndex < 0) return column.label;

    if (typeof this.data[rowIndex] == 'undefined') { console.error("[getValueAt] Invalid row index " + rowIndex); return null; }
    var rowData = this.data[rowIndex]['columns'];
    return rowData ? rowData[columnIndex] : null;
};

/**
 * Returns the display value (used for sorting and filtering) at the specified index
 * @param {Integer} rowIndex
 * @param {Integer} columnIndex
 */
EditableGrid.prototype.getDisplayValueAt = function (rowIndex, columnIndex) {
    // use renderer to get the value that must be used for sorting and filtering
    var value = this.getValueAt(rowIndex, columnIndex);
    var renderer = rowIndex < 0 ? this.columns[columnIndex].headerRenderer : this.columns[columnIndex].cellRenderer;
    return renderer.getDisplayValue(rowIndex, value);
};


/**
 * Sets the value at the specified index
 * @param {Integer} rowIndex
 * @param {Integer} columnIndex
 * @param {Object} value
 * @param {Boolean} render
 */
EditableGrid.prototype.setValueAt = function (rowIndex, columnIndex, value, render) {
    if (typeof render == "undefined") render = true;
    var previousValue = null;;

    // check and get column
    if (columnIndex < 0 || columnIndex >= this.columns.length) { console.error("[setValueAt] Invalid column index " + columnIndex); return null; }
    var column = this.columns[columnIndex];

    // set new value in model
    if (rowIndex < 0) {
        previousValue = column.label;
        column.label = value;
    }
    else {

        if (typeof this.data[rowIndex] == 'undefined') {
            console.error('Invalid rowindex ' + rowIndex);
            return null;
        }

        var rowData = this.data[rowIndex]['columns'];
        previousValue = rowData[columnIndex];
        if (rowData) rowData[columnIndex] = this.getTypedValue(columnIndex, value);
    }

    // render new value
    if (render) {
        var renderer = rowIndex < 0 ? column.headerRenderer : column.cellRenderer;
        var cell = this.getCell(rowIndex, columnIndex);
        if (cell) renderer._render(rowIndex, columnIndex, cell, value);
    }

    return previousValue;
};

/**
 * Find column index from its name
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.getColumnIndex = function (columnIndexOrName) {
    if (typeof columnIndexOrName == "undefined" || columnIndexOrName === "") return -1;

    // TODO: problem because the name of a column could be a valid index, and we cannot make the distinction here!

    // if columnIndexOrName is a number which is a valid index return it
    if (!isNaN(columnIndexOrName) && columnIndexOrName >= 0 && columnIndexOrName < this.columns.length) return columnIndexOrName;

    // otherwise search for the name
    for (var c = 0; c < this.columns.length; c++) if (this.columns[c].name == columnIndexOrName) return c;

    return -1;
};

/**
 * Get HTML row object at given index
 * @param {Integer} index of the row
 */
EditableGrid.prototype.getRow = function (rowIndex) {
    if (rowIndex < 0) return this.tHead.rows[rowIndex + this.nbHeaderRows];
    if (typeof this.data[rowIndex] == 'undefined') { console.error("[getRow] Invalid row index " + rowIndex); return null; }
    return _$(this._getRowDOMId(this.data[rowIndex].id));
};

/**
 * Get row id for given row index
 * @param {Integer} index of the row
 */
EditableGrid.prototype.getRowId = function (rowIndex) {
    return (rowIndex < 0 || rowIndex >= this.data.length) ? null : this.data[rowIndex]['id'];
};

/**
 * Get index of row (in filtered data) with given id
 * @param {Integer} rowId or HTML row object
 */
EditableGrid.prototype.getRowIndex = function (rowId) {
    rowId = typeof rowId == 'object' ? rowId.rowId : rowId;
    for (var rowIndex = 0; rowIndex < this.data.length; rowIndex++) if (this.data[rowIndex].id == rowId) return rowIndex;
    return -1;
};

/**
 * Get custom row attribute specified in XML
 * @param {Integer} index of the row
 * @param {String} name of the attribute
 */
EditableGrid.prototype.getRowAttribute = function (rowIndex, attributeName) {
    if (typeof this.data[rowIndex] == 'undefined') {
        console.error('Invalid rowindex ' + rowIndex);
        return null;
    }

    return this.data[rowIndex][attributeName];
};

/**
 * Set custom row attribute
 * @param {Integer} index of the row
 * @param {String} name of the attribute
 * @param value of the attribute
 */
EditableGrid.prototype.setRowAttribute = function (rowIndex, attributeName, attributeValue) {
    this.data[rowIndex][attributeName] = attributeValue;
};

/**
 * Get Id of row in HTML DOM
 * @private
 */
EditableGrid.prototype._getRowDOMId = function (rowId) {
    return this.currentContainerid != null ? this.name + "_" + rowId : rowId;
};

/**
 * Remove row with given id
 * Deprecated: use remove(rowIndex) instead
 * @param {Integer} rowId
 */
EditableGrid.prototype.removeRow = function (rowId) {
    return this.remove(this.getRowIndex(rowId));
};

/**
 * Remove row at given index
 * @param {Integer} rowIndex
 */
EditableGrid.prototype.remove = function (rowIndex) {
    var rowId = this.data[rowIndex].id;
    var originalIndex = this.data[rowIndex].originalIndex;
    var _data = this.dataUnfiltered == null ? this.data : this.dataUnfiltered;

    // delete row from DOM (needed for attach mode)
    var tr = _$(this._getRowDOMId(rowId));
    if (tr != null) this.tBody.removeChild(tr);

    // update originalRowIndex
    for (var r = 0; r < _data.length; r++) if (_data[r].originalIndex >= originalIndex) _data[r].originalIndex--;

    // delete row from data
    this.data.splice(rowIndex, 1);
    if (this.dataUnfiltered != null) for (var r = 0; r < this.dataUnfiltered.length; r++) if (this.dataUnfiltered[r].id == rowId) { this.dataUnfiltered.splice(r, 1); break; }

    // callback
    this.rowRemoved(rowIndex, rowId);

    // refresh grid
    this.refreshGrid();
};

/**
 * Return an associative array (column name => value) of values in row with given index 
 * @param {Integer} rowIndex
 */
EditableGrid.prototype.getRowValues = function (rowIndex) {
    var rowValues = {};
    for (var columnIndex = 0; columnIndex < this.getColumnCount(); columnIndex++) {
        rowValues[this.getColumnName(columnIndex)] = this.getValueAt(rowIndex, columnIndex);
    }
    return rowValues;
};

/**
 * Append row with given id and data
 * @param {Integer} rowId id of new row
 * @param {Integer} columns
 * @param {Boolean} dontSort
 */
EditableGrid.prototype.append = function (rowId, cellValues, rowAttributes, dontSort) {
    return this.insert(this.data.length, rowId, cellValues, rowAttributes, dontSort);
};

/**
 * Append row with given id and data
 * Deprecated: use append instead
 * @param {Integer} rowId id of new row
 * @param {Integer} columns
 * @param {Boolean} dontSort
 */
EditableGrid.prototype.addRow = function (rowId, cellValues, rowAttributes, dontSort) {
    return this.append(rowId, cellValues, rowAttributes, dontSort);
};

/**
 * Insert row with given id and data at given location
 * We know rowIndex is valid, unless the table is empty
 * @private
 */
EditableGrid.prototype._insert = function (rowIndex, offset, rowId, cellValues, rowAttributes, dontSort) {
    var originalRowId = null;
    var originalIndex = 0;
    var _data = this.dataUnfiltered == null ? this.data : this.dataUnfiltered;

    if (typeof this.data[rowIndex] != "undefined") {
        originalRowId = this.data[rowIndex].id;
        originalIndex = this.data[rowIndex].originalIndex + offset;
    }

    // append row in DOM (needed for attach mode)
    if (this.currentContainerid == null) {
        var tr = this.tBody.insertRow(rowIndex + offset);
        tr.rowId = rowId;
        tr.id = this._getRowDOMId(rowId);
        for (var c = 0; c < this.columns.length; c++) tr.insertCell(c);
    }

    // build data for new row
    var rowData = { visible: true, originalIndex: originalIndex, id: rowId };
    if (rowAttributes) for (var attributeName in rowAttributes) rowData[attributeName] = rowAttributes[attributeName];
    rowData.columns = [];
    for (var c = 0; c < this.columns.length; c++) {
        var cellValue = this.columns[c].name in cellValues ? cellValues[this.columns[c].name] : "";
        rowData.columns.push(this.getTypedValue(c, cellValue));
    }

    // update originalRowIndex
    for (var r = 0; r < _data.length; r++) if (_data[r].originalIndex >= originalIndex) _data[r].originalIndex++;

    // append row in data
    this.data.splice(rowIndex + offset, 0, rowData);
    if (this.dataUnfiltered != null) {
        if (originalRowId === null) this.dataUnfiltered.splice(rowIndex + offset, 0, rowData);
        else for (var r = 0; r < this.dataUnfiltered.length; r++) if (this.dataUnfiltered[r].id == originalRowId) { this.dataUnfiltered.splice(r + offset, 0, rowData); break; }
    }

    // refresh grid
    this.refreshGrid();

    // sort and filter table
    if (!dontSort) this.sort();
    this.filter();
};

/**
 * Insert row with given id and data before given row index
 * @param {Integer} rowIndex index of row before which to insert new row
 * @param {Integer} rowId id of new row
 * @param {Integer} columns
 * @param {Boolean} dontSort
 */
EditableGrid.prototype.insert = function (rowIndex, rowId, cellValues, rowAttributes, dontSort) {
    if (rowIndex < 0) rowIndex = 0;
    if (rowIndex >= this.data.length && this.data.length > 0) return this.insertAfter(this.data.length - 1, rowId, cellValues, rowAttributes, dontSort);
    return this._insert(rowIndex, 0, rowId, cellValues, rowAttributes, dontSort);
};

/**
 * Insert row with given id and data after given row index
 * @param {Integer} rowIndex index of row after which to insert new row
 * @param {Integer} rowId id of new row
 * @param {Integer} columns
 * @param {Boolean} dontSort
 */
EditableGrid.prototype.insertAfter = function (rowIndex, rowId, cellValues, rowAttributes, dontSort) {
    if (rowIndex < 0) return this.insert(0, rowId, cellValues, rowAttributes, dontSort);
    if (rowIndex >= this.data.length) rowIndex = Math.max(0, this.data.length - 1);
    return this._insert(rowIndex, 1, rowId, cellValues, rowAttributes, dontSort);
};

/**
 * Sets the column header cell renderer for the specified column index
 * @param {Object} columnIndexOrName index or name of the column
 * @param {CellRenderer} cellRenderer
 */
EditableGrid.prototype.setHeaderRenderer = function (columnIndexOrName, cellRenderer) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0) console.error("[setHeaderRenderer] Invalid column: " + columnIndexOrName);
    else {
        var column = this.columns[columnIndex];
        column.headerRenderer = (this.enableSort && column.datatype != "html") ? new SortHeaderRenderer(column.name, cellRenderer) : cellRenderer;

        // give access to the column from the cell renderer
        if (cellRenderer) {
            if (this.enableSort && column.datatype != "html") {
                column.headerRenderer.editablegrid = this;
                column.headerRenderer.column = column;
            }
            cellRenderer.editablegrid = this;
            cellRenderer.column = column;
        }
    }
};

/**
 * Sets the cell renderer for the specified column index
 * @param {Object} columnIndexOrName index or name of the column
 * @param {CellRenderer} cellRenderer
 */
EditableGrid.prototype.setCellRenderer = function (columnIndexOrName, cellRenderer) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0) console.error("[setCellRenderer] Invalid column: " + columnIndexOrName);
    else {
        var column = this.columns[columnIndex];
        column.cellRenderer = cellRenderer;

        // give access to the column from the cell renderer
        if (cellRenderer) {
            cellRenderer.editablegrid = this;
            cellRenderer.column = column;
        }
    }
};

/**
 * Sets the cell editor for the specified column index
 * @param {Object} columnIndexOrName index or name of the column
 * @param {CellEditor} cellEditor
 */
EditableGrid.prototype.setCellEditor = function (columnIndexOrName, cellEditor) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0) console.error("[setCellEditor] Invalid column: " + columnIndexOrName);
    else {
        var column = this.columns[columnIndex];
        column.cellEditor = cellEditor;

        // give access to the column from the cell editor
        if (cellEditor) {
            cellEditor.editablegrid = this;
            cellEditor.column = column;
        }
    }
};

/**
 * Sets the header cell editor for the specified column index
 * @param {Object} columnIndexOrName index or name of the column
 * @param {CellEditor} cellEditor
 */
EditableGrid.prototype.setHeaderEditor = function (columnIndexOrName, cellEditor) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0) console.error("[setHeaderEditor] Invalid column: " + columnIndexOrName);
    else {
        var column = this.columns[columnIndex];
        column.headerEditor = cellEditor;

        // give access to the column from the cell editor
        if (cellEditor) {
            cellEditor.editablegrid = this;
            cellEditor.column = column;
        }
    }
};

/**
 * Sets the enum provider for the specified column index
 * @param {Object} columnIndexOrName index or name of the column
 * @param {EnumProvider} enumProvider
 */
EditableGrid.prototype.setEnumProvider = function (columnIndexOrName, enumProvider) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0) console.error("[setEnumProvider] Invalid column: " + columnIndexOrName);
    else {
        var hadProviderAlready = this.columns[columnIndex].enumProvider != null;
        this.columns[columnIndex].enumProvider = enumProvider;

        // if needed, we recreate the cell renderer and editor for this column
        // if the column had an enum provider already, the render/editor previously created by default is ok already
        // ... and we don't want to erase a custom renderer/editor that may have been set before calling setEnumProvider
        if (!hadProviderAlready) {
            this._createCellRenderer(this.columns[columnIndex]);
            this._createCellEditor(this.columns[columnIndex]);
        }
    }
};

/**
 * Clear all cell validators for the specified column index
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.clearCellValidators = function (columnIndexOrName) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0) console.error("[clearCellValidators] Invalid column: " + columnIndexOrName);
    else this.columns[columnIndex].cellValidators = [];
};

/**
 * Adds default cell validators for the specified column index (according to the column type)
 * @param {Object} columnIndexOrName index or name of the column
 */
EditableGrid.prototype.addDefaultCellValidators = function (columnIndexOrName) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0) console.error("[addDefaultCellValidators] Invalid column: " + columnIndexOrName);
    return this._addDefaultCellValidators(this.columns[columnIndex]);
};

/**
 * Adds default cell validators for the specified column
 * @private
 */
EditableGrid.prototype._addDefaultCellValidators = function (column) {
    if (column.datatype == "integer" || column.datatype == "double") column.cellValidators.push(new NumberCellValidator(column.datatype));
    else if (column.datatype == "email") column.cellValidators.push(new EmailCellValidator());
    else if (column.datatype == "website" || column.datatype == "url") column.cellValidators.push(new WebsiteCellValidator());
    else if (column.datatype == "date") column.cellValidators.push(new DateCellValidator(this));
};

/**
 * Adds a cell validator for the specified column index
 * @param {Object} columnIndexOrName index or name of the column
 * @param {CellValidator} cellValidator
 */
EditableGrid.prototype.addCellValidator = function (columnIndexOrName, cellValidator) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0) console.error("[addCellValidator] Invalid column: " + columnIndexOrName);
    else this.columns[columnIndex].cellValidators.push(cellValidator);
};

/**
 * Sets the table caption: set as null to remove
 * @param columnIndexOrName
 * @param caption
 * @return
 */
EditableGrid.prototype.setCaption = function (caption) {
    this.caption = caption;
};

/**
 * Get cell element at given row and column
 */
EditableGrid.prototype.getCell = function (rowIndex, columnIndex) {
    var row = this.getRow(rowIndex);
    if (row == null) { console.error("[getCell] Invalid row index " + rowIndex); return null; }
    return row.cells[columnIndex];
};

/**
 * Get cell X position relative to the first non static offset parent
 * @private
 */
EditableGrid.prototype.getCellX = function (oElement) {
    var iReturnValue = 0;
    while (oElement != null && this.isStatic(oElement)) try {
        iReturnValue += oElement.offsetLeft;
        oElement = oElement.offsetParent;
    } catch (err) { oElement = null; }
    return iReturnValue;
};

/**
 * Get cell Y position relative to the first non static offset parent
 * @private
 */
EditableGrid.prototype.getCellY = function (oElement) {
    var iReturnValue = 0;
    while (oElement != null && this.isStatic(oElement)) try {
        iReturnValue += oElement.offsetTop;
        oElement = oElement.offsetParent;
    } catch (err) { oElement = null; }
    return iReturnValue;
};

/**
 * Get X scroll offset relative to the first non static offset parent
 * @private
 */
EditableGrid.prototype.getScrollXOffset = function (oElement) {
    var iReturnValue = 0;
    while (oElement != null && typeof oElement.scrollLeft != 'undefined' && this.isStatic(oElement) && oElement != document.body) try {
        iReturnValue += parseInt(oElement.scrollLeft);
        oElement = oElement.parentNode;
    } catch (err) { oElement = null; }
    return iReturnValue;
};

/**
 * Get Y scroll offset relative to the first non static offset parent
 * @private
 */
EditableGrid.prototype.getScrollYOffset = function (oElement) {
    var iReturnValue = 0;
    while (oElement != null && typeof oElement.scrollTop != 'undefined' && this.isStatic(oElement) && oElement != document.body) try {
        iReturnValue += parseInt(oElement.scrollTop);
        oElement = oElement.parentNode;
    } catch (err) { oElement = null; }
    return iReturnValue;
};

/**
 * Private
 * @param containerid
 * @param className
 * @param tableid
 * @return
 */
EditableGrid.prototype._rendergrid = function (containerid, className, tableid) {
    with (this) {

        lastSelectedRowIndex = -1;
        _currentPageIndex = getCurrentPageIndex();

        // if we are already attached to an existing table, just update the cell contents
        if (typeof table != "undefined" && table != null) {

            var _data = dataUnfiltered == null ? data : dataUnfiltered;

            // render headers
            _renderHeaders();

            // render content
            var rows = tBody.rows;
            var skipped = 0;
            var displayed = 0;
            var rowIndex = 0;

            for (var i = 0; i < rows.length; i++) {

                // filtering and pagination in attach mode means hiding rows
                if (!_data[i].visible || (pageSize > 0 && displayed >= pageSize)) {
                    if (rows[i].style.display != 'none') {
                        rows[i].style.display = 'none';
                        rows[i].hidden_by_editablegrid = true;
                    }
                }
                else {
                    if (skipped < pageSize * _currentPageIndex) {
                        skipped++;
                        if (rows[i].style.display != 'none') {
                            rows[i].style.display = 'none';
                            rows[i].hidden_by_editablegrid = true;
                        }
                    }
                    else {
                        displayed++;
                        var cols = rows[i].cells;
                        if (typeof rows[i].hidden_by_editablegrid != 'undefined' && rows[i].hidden_by_editablegrid) {
                            rows[i].style.display = '';
                            rows[i].hidden_by_editablegrid = false;
                        }
                        rows[i].rowId = getRowId(rowIndex);
                        rows[i].id = _getRowDOMId(rows[i].rowId);
                        for (var j = 0; j < cols.length && j < columns.length; j++)
                            if (columns[j].renderable) {
                                columns[j].cellRenderer._render(rowIndex, j, cols[j], getValueAt(rowIndex, j));
                            }
                    }
                    rowIndex++;
                }
            }

            // attach handler on click or double click 
            table.editablegrid = this;
            if (doubleclick) table.ondblclick = function (e) { this.editablegrid.mouseClicked(e); };
            else table.onclick = function (e) { this.editablegrid.mouseClicked(e); };
        }

        // we must render a whole new table
        else {

            if (!containerid) return console.error("Container ID not specified (renderGrid not called yet ?)");
            if (!_$(containerid)) return console.error("Unable to get element [" + containerid + "]");

            currentContainerid = containerid;
            currentClassName = className;
            currentTableid = tableid;

            var startRowIndex = 0;
            var endRowIndex = getRowCount();

            // paginate if required
            if (pageSize > 0) {
                startRowIndex = _currentPageIndex * pageSize;
                endRowIndex = Math.min(getRowCount(), startRowIndex + pageSize);
            }

            // create editablegrid table and add it to our container 
            this.table = document.createElement("table");
            table.className = className || "editablegrid";
            if (typeof tableid != "undefined") table.id = tableid;

            //while (_$(containerid).hasChildNodes()) _$(containerid).removeChild(_$(containerid).firstChild);
            $("#" + containerid).empty();

            _$(containerid).appendChild(table);

            // create header
            if (caption) {
                var captionElement = document.createElement("CAPTION");
                captionElement.innerHTML = this.caption;
                table.appendChild(captionElement);
            }

            this.tHead = document.createElement("THEAD");
            table.appendChild(tHead);
            var trHeader = tHead.insertRow(0);
            var columnCount = getColumnCount();
            for (var c = 0; c < columnCount; c++) {
                var headerCell = document.createElement("TH");
                var td = trHeader.appendChild(headerCell);
                columns[c].headerRenderer._render(-1, c, td, columns[c].label);
            }

            // create body and rows
            this.tBody = document.createElement("TBODY");
            table.appendChild(tBody);
            var insertRowIndex = 0;
            for (var i = startRowIndex; i < endRowIndex; i++) {
                var tr = tBody.insertRow(insertRowIndex++);
                tr.rowId = data[i]['id'];
                tr.id = this._getRowDOMId(data[i]['id']);

                //this is the grid item which contains id and values (which is the real Task)
                //add the completed class if so
                var item = this.rawData[this.getRowId(i)];
                if (item.values.isComplete) {
                    tr.className += " trComplete";
                }
                if (item.values.isSelected) {
                    tr.className += " selected";
                }
                if (item.values.isProjectRoot) {
                    tr.className += " trRoot";
                }

                for (j = 0; j < columnCount; j++) {
                    // create cell and render its content
                    var td = tr.insertCell(j);


                    if (j == this.getColumnIndex("description")) {
                        //get the indent level
                        var dataToSend = (jsData.settings.showComments) ? {
                            "desc": getValueAt(i, j),
                            "comment": item.values.comments
                        } : getValueAt(i, j);
                        columns[j].cellRenderer._render(i, j, td, dataToSend);

                        var indentLevel = item.values.indent;
                        td.style = "padding-left: " + 20 * indentLevel + "px";
                    }
                    else {
                        columns[j].cellRenderer._render(i, j, td, getValueAt(i, j));
                    }
                }
            }

            // attach handler on click or double click 
            _$(containerid).editablegrid = this;
            if (doubleclick) _$(containerid).ondblclick = function (e) { this.editablegrid.mouseClicked(e); };
            else _$(containerid).onclick = function (e) { this.editablegrid.mouseClicked(e); };
        }

        // callback
        tableRendered(containerid, className, tableid);
    }
};


/**
 * Renders the grid as an HTML table in the document
 * @param {String} containerid 
 * id of the div in which you wish to render the HTML table (this parameter is ignored if you used attachToHTMLTable)
 * @param {String} className 
 * CSS class name to be applied to the table (this parameter is ignored if you used attachToHTMLTable)
 * @param {String} tableid
 * ID to give to the table (this parameter is ignored if you used attachToHTMLTable)
 * @see EditableGrid#attachToHTMLTable
 * @see EditableGrid#loadXML
 */
EditableGrid.prototype.renderGrid = function (containerid, className, tableid) {
    // actually render grid
    this._rendergrid(containerid, className, tableid);

    // if client side: sort and filter
    if (!this.serverSide) {
        this.sort();
        this.filter();
    }
};


/**
 * Refreshes the grid
 * @return
 */
EditableGrid.prototype.refreshGrid = function () {
    if (this.currentContainerid != null) this.table = null; // if we are not in "attach mode", clear table to force a full re-render
    this._rendergrid(this.currentContainerid, this.currentClassName, this.currentTableid);
};

/**
 * Render all column headers 
 * @private
 */
EditableGrid.prototype._renderHeaders = function () {
    with (this) {
        var rows = tHead.rows;
        for (var i = 0; i < 1 /*rows.length*/; i++) {
            var rowData = [];
            var cols = rows[i].cells;
            var columnIndexInModel = 0;
            for (var j = 0; j < cols.length && columnIndexInModel < columns.length; j++) {
                columns[columnIndexInModel].headerRenderer._render(-1, columnIndexInModel, cols[j], columns[columnIndexInModel].label);
                var colspan = parseInt(cols[j].getAttribute("colspan"));
                columnIndexInModel += colspan > 1 ? colspan : 1;
            }
        }
    }
};

/**
 * Mouse click handler
 * @param {Object} e
 * @private
 */
EditableGrid.prototype.mouseClicked = function (e) {
    e = e || window.event;
    with (this) {

        // get row and column index from the clicked cell
        var target = e.target || e.srcElement;

        // go up parents to find a cell or a link under the clicked position
        while (target) if (target.tagName == "A" || target.tagName == "TD" || target.tagName == "TH") break; else target = target.parentNode;
        if (!target || !target.parentNode || !target.parentNode.parentNode || (target.parentNode.parentNode.tagName != "TBODY" && target.parentNode.parentNode.tagName != "THEAD") || target.isEditing) return;

        // don't handle clicks on links
        if (target.tagName == "A") return;

        // get cell position in table
        var rowIndex = getRowIndex(target.parentNode);
        var columnIndex = target.cellIndex;

        editCell(rowIndex, columnIndex);
    }
};

/**
 * Edit Cell
 * @param rowIndex
 * @param columnIndex
 * @private
 */
EditableGrid.prototype.editCell = function (rowIndex, columnIndex) {
    var target = this.getCell(rowIndex, columnIndex);
    with (this) {

        var column = columns[columnIndex];
        if (column) {

            // if another row has been selected: callback
            if (rowIndex > -1) {
                rowSelected(lastSelectedRowIndex, rowIndex);
                lastSelectedRowIndex = rowIndex;
            }

            // edit current cell value
            if (!column.editable) { readonlyWarning(column); }
            else {
                if (rowIndex < 0) {
                    if (column.headerEditor && isHeaderEditable(rowIndex, columnIndex))
                        column.headerEditor.edit(rowIndex, columnIndex, target, column.label);
                }
                else if (column.cellEditor && isEditable(rowIndex, columnIndex))
                    column.cellEditor.edit(rowIndex, columnIndex, target, getValueAt(rowIndex, columnIndex));
            }
        }
    }
};

/**
 * Moves columns around (added by JRE)
 * @param {array[strings]} an array of class names of the headers
 * returns boolean based on success
 */
EditableGrid.prototype.sortColumns = function (headerArray) {
    with (this) {
        newColumns = [];
        newColumnIndices = [];

        for (var i = 0; i < headerArray.length; i++) {

            columnIndex = this.getColumnIndex(headerArray[i]);
            if (columnIndex == -1) { // a column could not be found. can't reorder anything or data may be lost
                console.error("[sortColumns] Invalid column: " + columnIndex);
                return false;
            }

            newColumns[i] = this.columns[columnIndex];
            newColumnIndices[i] = columnIndex;
        }

        // rearrange headers
        this.columns = newColumns;

        // need to rearrange all of the data elements as well
        for (var i = 0; i < this.data.length; i++) {
            var myData = this.data[i];
            var myDataColumns = myData.columns;
            var newDataColumns = [];

            for (var j = 0; j < myDataColumns.length; j++) {
                newIndex = newColumnIndices[j];
                newDataColumns[j] = myDataColumns[newIndex];
            }

            this.data[i].columns = newDataColumns;
        }

        return true;
    }
};

/**
 * Sort on a column
 * @param {Object} columnIndexOrName index or name of the column
 * @param {Boolean} descending
 */
EditableGrid.prototype.sort = function (columnIndexOrName, descending, backOnFirstPage) {
    with (this) {

        if (typeof columnIndexOrName == 'undefined' && sortedColumnName === -1) {

            // avoid a double render, but still send the expected callback
            tableSorted(-1, sortDescending);
            return true;
        }

        if (typeof columnIndexOrName == 'undefined') columnIndexOrName = sortedColumnName;
        if (typeof descending == 'undefined') descending = sortDescending;

        localset('sortColumnIndexOrName', columnIndexOrName);
        localset('sortDescending', descending);

        // if sorting is done on server-side, we are done here
        if (serverSide) return backOnFirstPage ? setPageIndex(0) : refreshGrid();

        var columnIndex = columnIndexOrName;
        if (parseInt(columnIndex, 10) !== -1) {
            columnIndex = this.getColumnIndex(columnIndexOrName);
            if (columnIndex < 0) {
                console.error("[sort] Invalid column: " + columnIndexOrName);
                return false;
            }
        }

        if (!enableSort) {
            tableSorted(columnIndex, descending);
            return;
        }

        // work on unfiltered data
        var filterActive = dataUnfiltered != null;
        if (filterActive) data = dataUnfiltered;

        var type = columnIndex < 0 ? "" : getColumnType(columnIndex);
        var row_array = [];
        var rowCount = getRowCount();
        for (var i = 0; i < rowCount - (ignoreLastRow ? 1 : 0); i++) row_array.push([columnIndex < 0 ? null : getDisplayValueAt(i, columnIndex), i, data[i].originalIndex]);

        var sort_function = type == "integer" || type == "double" ? sort_numeric : type == "boolean" ? sort_boolean : type == "date" ? sort_date : sort_alpha;
        row_array.sort(columnIndex < 0 ? unsort : sort_stable(sort_function, descending));
        if (ignoreLastRow) row_array.push([columnIndex < 0 ? null : getDisplayValueAt(rowCount - 1, columnIndex), rowCount - 1, data[rowCount - 1].originalIndex]);

        // rebuild data using the new order
        var _data = data;
        data = [];
        for (var i = 0; i < row_array.length; i++) data.push(_data[row_array[i][1]]);
        delete row_array;

        if (filterActive) {

            // keep only visible rows in data
            dataUnfiltered = data;
            data = [];
            for (var r = 0; r < rowCount; r++) if (dataUnfiltered[r].visible) data.push(dataUnfiltered[r]);
        }

        // refresh grid (back on first page if sort column has changed) and callback
        if (backOnFirstPage) setPageIndex(0); else refreshGrid();
        tableSorted(columnIndex, descending);
        return true;
    }
};


/**
 * Filter the content of the table
 * @param {String} filterString String string used to filter: all words must be found in the row
 * @param {Array} cols Columns to sort.  If cols is not specified, the filter will be done on all columns
 */
EditableGrid.prototype.filter = function (filterString, cols) {
    with (this) {

        if (typeof filterString != 'undefined') {
            this.currentFilter = filterString;
            this.localset('filter', filterString);
        }

        // if filtering is done on server-side, we are done here
        if (serverSide) return setPageIndex(0);

        // un-filter if no or empty filter set
        if (currentFilter == null || currentFilter == "") {
            if (dataUnfiltered != null) {
                data = dataUnfiltered;
                dataUnfiltered = null;
                for (var r = 0; r < getRowCount(); r++) data[r].visible = true;
                setPageIndex(0);
                tableFiltered();
            }
            return;
        }

        var words = currentFilter.toLowerCase().split(" ");

        // work on unfiltered data
        if (dataUnfiltered != null) data = dataUnfiltered;

        var rowCount = getRowCount();
        var columnCount = typeof cols != 'undefined' ? cols.length : getColumnCount();

        for (var r = 0; r < rowCount; r++) {
            var row = data[r];
            row.visible = true;
            var rowContent = "";

            // add column values
            for (var c = 0; c < columnCount; c++) {
                if (getColumnType(c) == 'boolean') continue;
                var displayValue = getDisplayValueAt(r, typeof cols != 'undefined' ? cols[c] : c);
                var value = getValueAt(r, typeof cols != 'undefined' ? cols[c] : c);
                rowContent += displayValue + " " + (displayValue == value ? "" : value + " ");
            }

            // add attribute values
            for (var attributeName in row) {
                if (attributeName != "visible" && attributeName != "originalIndex" && attributeName != "columns") rowContent += row[attributeName];
            }

            // if row contents do not match one word in the filter, hide the row
            for (var i = 0; i < words.length; i++) {
                var word = words[i];
                var match = false;

                // a word starting with "!" means that we want a NON match
                var invertMatch = word.startsWith("!");
                if (invertMatch) word = word.substr(1);

                // if word is of the form "colname/attributename=value" or "colname/attributename!=value", only this column/attribute is used
                var colindex = -1;
                var attributeName = null;
                if (word.contains("!=")) {
                    var parts = word.split("!=");
                    colindex = getColumnIndex(parts[0]);
                    if (colindex >= 0) {
                        word = parts[1];
                        invertMatch = !invertMatch;
                    }
                    else if (typeof row[parts[0]] != 'undefined') {
                        attributeName = parts[0];
                        word = parts[1];
                        invertMatch = !invertMatch;
                    }
                }
                else if (word.contains("=")) {
                    var parts = word.split("=");
                    colindex = getColumnIndex(parts[0]);
                    if (colindex >= 0) word = parts[1];
                    else if (typeof row[parts[0]] != 'undefined') {
                        attributeName = parts[0];
                        word = parts[1];
                    }
                }

                // a word ending with "!" means that a column must match this word exactly
                if (!word.endsWith("!")) {
                    if (colindex >= 0) match = (getValueAt(r, colindex) + ' ' + getDisplayValueAt(r, colindex)).trim().toLowerCase().indexOf(word) >= 0;
                    else if (attributeName !== null) match = ('' + getRowAttribute(r, attributeName)).trim().toLowerCase().indexOf(word) >= 0;
                    else match = rowContent.toLowerCase().indexOf(word) >= 0;
                }
                else {
                    word = word.substr(0, word.length - 1);
                    if (colindex >= 0) match = ('' + getDisplayValueAt(r, colindex)).trim().toLowerCase() == word || ('' + getValueAt(r, colindex)).trim().toLowerCase() == word;
                    else if (attributeName !== null) match = ('' + getRowAttribute(r, attributeName)).trim().toLowerCase() == word;
                    else for (var c = 0; c < columnCount; c++) {
                        if (getColumnType(typeof cols != 'undefined' ? cols[c] : c) == 'boolean') continue;
                        if (('' + getDisplayValueAt(r, typeof cols != 'undefined' ? cols[c] : c)).trim().toLowerCase() == word || ('' + getValueAt(r, typeof cols != 'undefined' ? cols[c] : c)).trim().toLowerCase() == word) match = true;
                    }
                }

                if (invertMatch ? match : !match) {
                    data[r].visible = false;
                    break;
                }
            }
        }

        // keep only visible rows in data
        dataUnfiltered = data;
        data = [];
        for (var r = 0; r < rowCount; r++) if (dataUnfiltered[r].visible) data.push(dataUnfiltered[r]);

        // refresh grid (back on first page) and callback
        setPageIndex(0);
        tableFiltered();
    }
};



/**
 * Sets the page size(pageSize of 0 means no pagination)
 * @param {Integer} pageSize Integer page size
 */
EditableGrid.prototype.setPageSize = function (pageSize) {
    this.pageSize = parseInt(pageSize);
    if (isNaN(this.pageSize)) this.pageSize = 0;
    this.currentPageIndex = 0;
    this.refreshGrid();
};

/**
 * Returns the number of pages according to the current page size
 */
EditableGrid.prototype.getPageCount = function () {
    if (this.getRowCount() == 0) return 0;
    if (this.pageCount > 0) return this.pageCount; // server side pagination
    if (this.pageSize <= 0) return 1; // no client side pagination: one page
    return Math.ceil(this.getRowCount() / this.pageSize);
};

/**
 * Returns the number of pages according to the current page size
 */
EditableGrid.prototype.getCurrentPageIndex = function () {
    // if pagination is handled on the server side, pageSize will (must) be 0
    if (this.pageSize <= 0 && !this.serverSide) return 0;

    // if page index does not exist anymore, go to last page (without losing the information of the current page)
    return Math.max(0, this.currentPageIndex >= this.getPageCount() ? this.getPageCount() - 1 : this.currentPageIndex);
};

/**
 * Sets the current page (no effect if pageSize is 0)
 * @param {Integer} pageIndex Integer page index
 */
EditableGrid.prototype.setPageIndex = function (pageIndex) {
    this.currentPageIndex = pageIndex;
    this.localset('pageIndex', pageIndex);
    this.refreshGrid();
};

/**
 * Go the previous page if we are not already on the first page
 * @return
 */
EditableGrid.prototype.prevPage = function () {
    if (this.canGoBack()) this.setPageIndex(this.getCurrentPageIndex() - 1);
};

/**
 * Go the first page if we are not already on the first page
 * @return
 */
EditableGrid.prototype.firstPage = function () {
    if (this.canGoBack()) this.setPageIndex(0);
};

/**
 * Go the next page if we are not already on the last page
 * @return
 */
EditableGrid.prototype.nextPage = function () {
    if (this.canGoForward()) this.setPageIndex(this.getCurrentPageIndex() + 1);
};

/**
 * Go the last page if we are not already on the last page
 * @return
 */
EditableGrid.prototype.lastPage = function () {
    if (this.canGoForward()) this.setPageIndex(this.getPageCount() - 1);
};

/**
 * Returns true if we are not already on the first page
 * @return
 */
EditableGrid.prototype.canGoBack = function () {
    return this.getCurrentPageIndex() > 0;
};

/**
 * Returns true if we are not already on the last page
 * @return
 */
EditableGrid.prototype.canGoForward = function () {
    return this.getCurrentPageIndex() < this.getPageCount() - 1;
};

/**
 * Returns an interval { startPageIndex: ..., endPageIndex: ... } so that a window of the given size is visible around the current page (hence the 'sliding').
 * If pagination is not enabled this method displays an error and returns null.
 * If pagination is enabled but there is only one page this function returns null (wihtout error).
 * @param slidingWindowSize size of the visible window
 * @return
 */
EditableGrid.prototype.getSlidingPageInterval = function (slidingWindowSize) {
    var nbPages = this.getPageCount();
    if (nbPages <= 1) return null;

    var curPageIndex = this.getCurrentPageIndex();
    var startPageIndex = Math.max(0, curPageIndex - Math.floor(slidingWindowSize / 2));
    var endPageIndex = Math.min(nbPages - 1, curPageIndex + Math.floor(slidingWindowSize / 2));

    if (endPageIndex - startPageIndex < slidingWindowSize) {
        var diff = slidingWindowSize - (endPageIndex - startPageIndex + 1);
        startPageIndex = Math.max(0, startPageIndex - diff);
        endPageIndex = Math.min(nbPages - 1, endPageIndex + diff);
    }

    return { startPageIndex: startPageIndex, endPageIndex: endPageIndex };
};

/**
 * Returns an array of page indices in the given interval.
 * 
 * @param interval
 * The given interval must be an object with properties 'startPageIndex' and 'endPageIndex'.
 * This interval may for example have been obtained with getCurrentPageInterval.
 * 
 * @param callback
 * The given callback is applied to each page index before adding it to the result array.
 * This callback is optional: if none given, the page index will be added as is to the array.
 * If given , the callback will be called with two parameters: pageIndex (integer) and isCurrent (boolean).
 * 
 * @return
 */
EditableGrid.prototype.getPagesInInterval = function (interval, callback) {
    var pages = [];
    for (var p = interval.startPageIndex; p <= interval.endPageIndex; p++) {
        pages.push(typeof callback == 'function' ? callback(p, p == this.getCurrentPageIndex()) : p);
    }
    return pages;
};


/**
 * Abstract cell editor
 * @constructor
 * @class Base class for all cell editors
 */

function CellEditor(config) { this.init(config); }

CellEditor.prototype.init = function (config) {
    // override default properties with the ones given
    if (config) for (var p in config) this[p] = config[p];
};

CellEditor.prototype.edit = function (rowIndex, columnIndex, element, value) {
    // tag element and remember all the things we need to apply/cancel edition
    element.isEditing = true;
    element.rowIndex = rowIndex;
    element.columnIndex = columnIndex;

    // call the specialized getEditor method
    var editorInput = this.getEditor(element, value);
    if (!editorInput) return false;

    // give access to the cell editor and element from the editor widget
    editorInput.element = element;
    editorInput.celleditor = this;

    // listen to pressed keys
    // - tab does not work with onkeyup (it's too late)
    // - on Safari escape does not work with onkeypress
    // - with onkeydown everything is fine (but don't forget to return false)
    var self = this;
    editorInput.onkeydown = function (event) {

        event = event || window.event;

        //this check is added to allow events to go to the autocomplete feature
        if ($(this).data("autocompleting")) {
            return;
        }
        // ENTER or TAB: apply value
        if (event.keyCode == 13 || event.keyCode == 9) {

            // backup onblur then remove it: it will be restored if editing could not be applied
            this.onblur_backup = this.onblur;
            this.onblur = null;
            if (this.celleditor.applyEditing(this.element, this.celleditor.getEditorValue(this)) === false) this.onblur = this.onblur_backup;

            // TAB: move to next cell
            if (event.keyCode == 9) {
                if (this.element.rowIndex >= 0 && this.celleditor.editablegrid.getColumnCount() > 0 && this.celleditor.editablegrid.getRowCount() > 0) {

                    var candidateRowIndex = this.element.rowIndex;
                    var candidateColumnIndex = this.element.columnIndex;

                    while (true) {
                        //TODO find a way to simplify this code instead of duplicating
                        // find next cell in grid, go backward if holding SHIFT
                        if (event.shiftKey) {
                            if (candidateColumnIndex > 0) candidateColumnIndex--;
                            else { candidateRowIndex--; candidateColumnIndex = this.celleditor.editablegrid.getColumnCount() - 1; }
                            if (candidateRowIndex < 0) candidateRowIndex = this.celleditor.editablegrid.getRowCount() - 1;
                        }
                        else {
                            if (candidateColumnIndex < this.celleditor.editablegrid.getColumnCount() - 1) candidateColumnIndex++;
                            else { candidateRowIndex++; candidateColumnIndex = 0; }
                            if (candidateRowIndex >= this.celleditor.editablegrid.getRowCount()) candidateRowIndex = 0;
                        }

                        // candidate cell is editable: edit it and break
                        var column = this.celleditor.editablegrid.getColumn(candidateColumnIndex);
                        if (column.editable && column.datatype != 'boolean' && this.celleditor.editablegrid.isEditable(candidateRowIndex, candidateColumnIndex)) {
                            this.celleditor.editablegrid.editCell(candidateRowIndex, candidateColumnIndex);
                            break;
                        }

                        // if we ever come back to the original cell, break
                        if (candidateRowIndex == this.element.rowIndex && candidateColumnIndex == this.element.columnIndex) break;
                    }
                }
            }

            return false;
        }

        // ESC: cancel editing
        if (event.keyCode == 27) {
            this.onblur = null;
            this.celleditor.cancelEditing(this.element);
            self.editablegrid.editorCancelled(rowIndex, columnIndex, this)
            return false;
        }
    };

    // if simultaneous edition is not allowed, we cancel edition when focus is lost

    if (!this.editablegrid.allowSimultaneousEdition) editorInput.onblur = this.editablegrid.saveOnBlur ? function (event) {

        // backup onblur then remove it: it will be restored if editing could not be applied
        this.onblur_backup = this.onblur;
        this.onblur = null;
        if (this.celleditor.applyEditing(this.element, this.celleditor.getEditorValue(this)) === false) {
            this.onblur = this.onblur_backup;
        } else {
            //call the callback so a listener can handle it
            self.editablegrid.editorBlurred(rowIndex, columnIndex, this);
        }
    }
        : function (event) {
            this.onblur = null;
            this.celleditor.cancelEditing(this.element);
        };

    // display the resulting editor widget
    this.displayEditor(element, editorInput);

    // give focus to the created editor
    this.autoFocus(editorInput);

    //auto focus the input if supported (for new tasks)
    this.scrollIntoView(editorInput);
};

CellEditor.prototype.scrollIntoView = function (editorInput) {
    //TODO clean these calls up (maybe just formatting?)
    if (jQuery(editorInput).position()) {
        if (jQuery(editorInput).position().top < jQuery(window).scrollTop()) {
            //scroll up
            jQuery('html,body').animate({ scrollTop: jQuery(editorInput).position().top }, 100);
        }
        else if (jQuery(editorInput).position().top + jQuery(editorInput).height() > jQuery(window).scrollTop() + (window.innerHeight || document.documentElement.clientHeight)) {
            //scroll down
            jQuery('html,body').animate({ scrollTop: jQuery(editorInput).position().top - (window.innerHeight || document.documentElement.clientHeight) + jQuery(editorInput).height() + 15 }, 100);
        }
    }
};

CellEditor.prototype.autoFocus = function (editorInput) {
    editorInput.focus();
};

CellEditor.prototype.getEditor = function (element, value) {
    return null;
};

CellEditor.prototype.getEditorValue = function (editorInput) {
    return editorInput.value;
};

CellEditor.prototype.formatValue = function (value) {
    return value;
};

CellEditor.prototype.displayEditor = function (element, editorInput, adjustX, adjustY) {
    // use same font in input as in cell content
    editorInput.style.fontFamily = this.editablegrid.getStyle(element, "fontFamily", "font-family");
    editorInput.style.fontSize = this.editablegrid.getStyle(element, "fontSize", "font-size");

    // static mode: add input field in the table cell
    if (this.editablegrid.editmode == "static") {
        while (element.hasChildNodes()) element.removeChild(element.firstChild);
        element.appendChild(editorInput);
    }

    // absolute mode: add input field in absolute position over table cell, leaving current content
    if (this.editablegrid.editmode == "absolute") {
        element.appendChild(editorInput);
        editorInput.style.position = "absolute";

        // position editor input on the cell with the same padding as the actual cell content (and center vertically if vertical-align is set to "middle")
        var paddingLeft = this.editablegrid.paddingLeft(element);
        var paddingTop = this.editablegrid.paddingTop(element);

        // find scroll offset
        var offsetScrollX = this.editablegrid.getScrollXOffset(element);
        var offsetScrollY = this.editablegrid.getScrollYOffset(element);

        // position input
        var vCenter = this.editablegrid.verticalAlign(element) == "middle" ? (element.offsetHeight - editorInput.offsetHeight) / 2 - paddingTop : 0;
        editorInput.style.left = (this.editablegrid.getCellX(element) - offsetScrollX + paddingLeft + (adjustX ? adjustX : 0)) + "px";
        editorInput.style.top = (this.editablegrid.getCellY(element) - offsetScrollY + paddingTop + vCenter + (adjustY ? adjustY : 0)) + "px";

        // if number type: align field and its content to the right
        if (this.column.datatype == 'integer' || this.column.datatype == 'double') {
            var rightPadding = this.editablegrid.getCellX(element) - offsetScrollX + element.offsetWidth - (parseInt(editorInput.style.left) + editorInput.offsetWidth);
            editorInput.style.left = (parseInt(editorInput.style.left) + rightPadding) + "px";
            editorInput.style.textAlign = "right";
        }
    }

    // fixed mode: don't show input field in the cell 
    if (this.editablegrid.editmode == "fixed") {
        var editorzone = _$(this.editablegrid.editorzoneid);
        while (editorzone.hasChildNodes()) editorzone.removeChild(editorzone.firstChild);
        editorzone.appendChild(editorInput);
    }

    if (element && element.isEditing && this.editablegrid.openedCellEditor) {
        this.editablegrid.openedCellEditor(element.rowIndex, element.columnIndex);
    }
};

CellEditor.prototype._clearEditor = function (element) {
    // untag element
    element.isEditing = false;

    // clear fixed editor zone if any
    if (this.editablegrid.editmode == "fixed") {
        var editorzone = _$(this.editablegrid.editorzoneid);
        while (editorzone.hasChildNodes()) editorzone.removeChild(editorzone.firstChild);
    }
};

CellEditor.prototype.cancelEditing = function (element) {
    with (this) {

        // check that the element is still being edited (otherwise onblur will be called on textfields that have been closed when we go to another tab in Firefox) 
        if (element && element.isEditing) {

            // render value before editon
            var renderer = this == column.headerEditor ? column.headerRenderer : column.cellRenderer;
            renderer._render(element.rowIndex, element.columnIndex, element, editablegrid.getValueAt(element.rowIndex, element.columnIndex));

            _clearEditor(element);
        }
    }
};

CellEditor.prototype.applyEditing = function (element, newValue) {
    with (this) {

        // check that the element is still being edited (otherwise onblur will be called on textfields that have been closed when we go to another tab in Firefox)
        if (element && element.isEditing) {

            // do nothing if the value is rejected by at least one validator
            if (!column.isValid(newValue)) return false;

            // format the value before applying
            var formattedValue = formatValue(newValue);

            // update model and render cell (keeping previous value)
            var previousValue = editablegrid.setValueAt(element.rowIndex, element.columnIndex, formattedValue);

            // if the new value is different than the previous one, let the user handle the model change
            var newValue = editablegrid.getValueAt(element.rowIndex, element.columnIndex);
            if (!this.editablegrid.isSame(newValue, previousValue)) {
                editablegrid.modelChanged(element.rowIndex, element.columnIndex, previousValue, newValue, editablegrid.getRow(element.rowIndex));
            }

            _clearEditor(element);
            return true;
        }

        return false;
    }
};

/**
 * Text cell editor
 * @constructor
 * @class Class to edit a cell with an HTML text input 
 */

function TextCellEditor(size, maxlen, config) {
    if (size) this.fieldSize = size;
    if (maxlen) this.maxLength = maxlen;
    if (config) this.init(config);
};

TextCellEditor.prototype = new CellEditor();
TextCellEditor.prototype.fieldSize = -1;
TextCellEditor.prototype.maxLength = -1;
TextCellEditor.prototype.autoHeight = true;

TextCellEditor.prototype.editorValue = function (value) {
    return value;
};

TextCellEditor.prototype.updateStyle = function (htmlInput) {
    // change style for invalid values
    if (this.column.isValid(this.getEditorValue(htmlInput))) this.editablegrid.removeClassName(htmlInput, this.editablegrid.invalidClassName);
    else this.editablegrid.addClassName(htmlInput, this.editablegrid.invalidClassName);
};

TextCellEditor.prototype.getEditor = function (element, value) {
    // create and initialize text field
    var htmlInput = document.createElement("input");
    htmlInput.setAttribute("type", "text");
    if (this.maxLength > 0) htmlInput.setAttribute("maxlength", this.maxLength);

    if (this.fieldSize > 0) htmlInput.setAttribute("size", this.fieldSize);
    else htmlInput.style.width = this.editablegrid.autoWidth(element) + 'px'; // auto-adapt width to cell, if no length specified 

    var autoHeight = this.editablegrid.autoHeight(element);
    if (this.autoHeight) htmlInput.style.height = autoHeight + 'px'; // auto-adapt height to cell
    htmlInput.value = this.editorValue(value);

    // listen to keyup to check validity and update style of input field 
    htmlInput.onkeyup = function (event) { this.celleditor.updateStyle(this); };

    return htmlInput;
};

TextCellEditor.prototype.displayEditor = function (element, htmlInput) {
    // call base method
    CellEditor.prototype.displayEditor.call(this, element, htmlInput, -1 * this.editablegrid.borderLeft(htmlInput), -1 * (this.editablegrid.borderTop(htmlInput) + 1));

    // update style of input field
    this.updateStyle(htmlInput);

    // select text
    htmlInput.select();
};

/**
 * Number cell editor
 * @constructor
 * @class Class to edit a numeric cell with an HTML text input 
 */

function NumberCellEditor(type, config) {
    this.type = type;
    this.init(config);
}

NumberCellEditor.prototype = new TextCellEditor(-1, 32);

//editorValue is called in getEditor to initialize field
NumberCellEditor.prototype.editorValue = function (value) {
    return (value === null || isNaN(value)) ? "" : (value + '').replace('.', this.column.decimal_point);
};

//getEditorValue is called before passing to isValid and applyEditing
NumberCellEditor.prototype.getEditorValue = function (editorInput) {
    return editorInput.value.replace(',', '.');
};

//formatValue is called in applyEditing
NumberCellEditor.prototype.formatValue = function (value) {
    return this.type == 'integer' ? parseInt(value) : parseFloat(value);
};

//TODO: clean up variable names
/**
 * Number cell editor
 * @constructor
 * @class Class to edit a numeric cell with an HTML text input 
 */

function ArrayCellEditor(config) {
    this.init(config);
}

ArrayCellEditor.prototype = new TextCellEditor(-1, -1);

//editorValue is called in getEditor to initialize field
ArrayCellEditor.prototype.editorValue = function (value) {
    return (value === null) ? "" : value;
};

//getEditorValue is called before passing to isValid and applyEditing
ArrayCellEditor.prototype.getEditorValue = function (editorInput) {
    //this is the first call, so here the split is done
    //TODO add some proper error checking here

    var value = editorInput.value.trim();

    if (value === "") {
        return [];
    }

    return editorInput.value.split(",");
};

/**
 * Select cell editor
 * @constructor
 * @class Class to edit a cell with an HTML select input 
 */

function SelectCellEditor(config) {
    this.minWidth = 75;
    this.minHeight = 22;
    this.adaptHeight = true;
    this.adaptWidth = true;
    this.init(config);
}

SelectCellEditor.prototype = new CellEditor();
SelectCellEditor.prototype.isValueSelected = function (htmlInput, optionValue, value) { return (!optionValue && !value) || (optionValue == value); };
SelectCellEditor.prototype.getEditor = function (element, value) {
    var self = this;

    // create select list
    var htmlInput = document.createElement("select");

    // auto adapt dimensions to cell, with a min width
    if (this.adaptWidth && typeof jQuery.fn.select2 == 'undefined') htmlInput.style.width = Math.max(this.minWidth, this.editablegrid.autoWidth(element)) + 'px';
    if (this.adaptHeight && typeof jQuery.fn.select2 == 'undefined') htmlInput.style.height = Math.max(this.minHeight, this.editablegrid.autoHeight(element)) + 'px';

    // get column option values for this row 
    var optionValues = this.column.getOptionValuesForEdit(element.rowIndex);

    // add these options, selecting the current one
    var index = 0, valueFound = false;
    for (var optionIndex = 0; optionIndex < optionValues.length; optionIndex++) {
        var optionValue = optionValues[optionIndex];

        // if values are grouped
        if (typeof optionValue.values == 'object') {

            var optgroup = document.createElement('optgroup');
            optgroup.label = optionValue.label;
            htmlInput.appendChild(optgroup);

            for (var groupOptionIndex = 0; groupOptionIndex < optionValue.values.length; groupOptionIndex++) {
                var groupOptionValue = optionValue.values[groupOptionIndex];
                var option = document.createElement('option');
                option.text = groupOptionValue.label;
                option.value = groupOptionValue.value ? groupOptionValue.value : ""; // this otherwise changes a null into a "null" !
                optgroup.appendChild(option);
                if (this.isValueSelected(htmlInput, groupOptionValue.value, value)) { option.selected = true; valueFound = true; } else option.selected = false;
                index++;
            }
        }
        else {

            var option = document.createElement('option');
            option.text = optionValue.label;
            option.value = optionValue.value ? optionValue.value : ""; // this otherwise changes a null into a "null" !
            // add does not work as expected in IE7 (cf. second arg)
            try { htmlInput.add(option, null); } catch (e) { htmlInput.add(option); }
            if (this.isValueSelected(htmlInput, optionValue.value, value)) { option.selected = true; valueFound = true; } else option.selected = false;
            index++;
        }
    }

    // if the current value is not in the list add it to the front
    if (!valueFound) {
        var option = document.createElement('option');
        option.text = value ? value : "";
        option.value = value ? value : "";
        // add does not work as expected in IE7 (cf. second arg)
        try { htmlInput.add(option, htmlInput.options[0]); } catch (e) { htmlInput.add(option); }
        htmlInput.selectedIndex = 0;
    }

    // when a new value is selected we apply it
    htmlInput.onchange = function (event) { this.onblur = null; this.celleditor.applyEditing(this.element, self.getEditorValue(this)); };

    return htmlInput;
};

//redefine displayEditor to setup select2
SelectCellEditor.prototype.displayEditor = function (element, htmlInput) {
    // call base method
    CellEditor.prototype.displayEditor.call(this, element, htmlInput);

    // use select2 if loaded
    if (typeof jQuery.fn.select2 != 'undefined') {

        // select2 v4 calls onblur before onchange, when the value is not changed yet
        htmlInput.onblur = null;
        htmlInput.onchange = null;

        // setup and open
        jQuery(htmlInput).select2({
            dropdownAutoWidth: true,
            minimumResultsForSearch: 10 // since Select2 v4, escape and arrow keys will not work correctly if no search box present... cf. TODO in autoFocus below
        });

        // select2 v4 does not position right in X: do it then open so that drodown is also positioned correctly
        jQuery(htmlInput).siblings('span.select2-container').css('position', 'absolute').css('left', htmlInput.style.left);
        jQuery(htmlInput).select2('open');

        // catches select2-blur and select2-close to apply (or cancel) editing
        jQuery(htmlInput)
            .on('select2:close', function () { this.celleditor.applyEditing(this.element, this.celleditor.getEditorValue(this)); }) // v4
            .on('select2-blur', function () { this.celleditor.applyEditing(this.element, this.celleditor.getEditorValue(this)); }) // v3
            .on('select2-close', function () { this.celleditor.applyEditing(this.element, this.celleditor.getEditorValue(this)); }); // v3
    }
};

SelectCellEditor.prototype.autoFocus = function (editorInput) {
    // no autofocus on original select otherwise this select appears when hitting arrow
    if (typeof jQuery.fn.select2 != 'undefined') {

        // TODO: select2('open') does not give focus as when the user clicks... side effects = escape does not work and arrows scroll the whole body... unless a search box is present!
        return true;
    }

    return CellEditor.prototype.autoFocus.call(this, editorInput);
};

SelectCellEditor.prototype.getEditorValue = function (editorInput) {
    // use select2 if loaded
    if (typeof jQuery.fn.select2 != 'undefined') return jQuery(editorInput).val();

    return CellEditor.prototype.getEditorValue.call(this, editorInput);
};

SelectCellEditor.prototype.cancelEditing = function (element) {
    // destroy select2 if loaded
    if (typeof jQuery.fn.select2 != 'undefined') jQuery(element).find('select').select2('destroy');

    // call base method
    CellEditor.prototype.cancelEditing.call(this, element);
};

/**
 * Datepicker cell editor
 * 
 * Text field editor with date picker capabilities.
 * Uses the jQuery UI's datepicker.
 * This editor is used automatically for date columns if we detect that the jQuery UI's datepicker is present. 
 * 
 * @constructor Accepts an option object containing the following properties: 
 * - fieldSize: integer (default=auto-adapt)
 * - maxLength: integer (default=255)
 * 
 * @class Class to edit a cell with a datepicker linked to the HTML text input
 */

function DateCellEditor(config) {
    // erase defaults with given options
    this.init(config);
};

//inherits TextCellEditor functionalities
DateCellEditor.prototype = new TextCellEditor();

//redefine displayEditor to setup datepicker
DateCellEditor.prototype.displayEditor = function (element, htmlInput) {
    // call base method
    TextCellEditor.prototype.displayEditor.call(this, element, htmlInput);

    jQuery(htmlInput).datepicker({
        dateFormat: (this.editablegrid.dateFormat == "EU" ? "dd/mm/yy" : "mm/dd/yy"),
        changeMonth: true,
        changeYear: true,
        yearRange: "c-100:c+10",
        beforeShow: function () {
            // the field cannot be blurred until the datepicker has gone away
            // otherwise we get the "missing instance data" exception
            this.onblur_backup = this.onblur;
            this.onblur = null;
        },
        onClose: function (dateText) {
            // apply date if any, otherwise call original onblur event
            if (dateText != '') this.celleditor.applyEditing(htmlInput.element, dateText);
            else if (this.onblur_backup != null) this.onblur_backup();

        }
    }).datepicker('show');
};

EditableGrid.prototype._convertOptions = function (optionValues) {
    // option values should be an *ordered* array of value/label pairs, but to stay compatible with existing enum providers 
    if (optionValues !== null && (!(optionValues instanceof Array)) && typeof optionValues == 'object') {
        var _converted = [];
        for (var value in optionValues) {
            if (typeof optionValues[value] == 'object') _converted.push({ label: value, values: this._convertOptions(optionValues[value]) }); // group
            else _converted.push({ value: value, label: optionValues[value] });
        }
        optionValues = _converted;
    }

    return optionValues;
};

EditableGrid.prototype.setCookie = function (c_name, value, exdays) {
    var exdate = new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value = escape(value) + ((exdays == null) ? "" : "; expires=" + exdate.toUTCString());
    document.cookie = c_name + "=" + c_value;
};

EditableGrid.prototype.getCookie = function (c_name) {
    var _cookies = document.cookie.split(";");
    for (var i = 0; i < _cookies.length; i++) {
        var x = _cookies[i].substr(0, _cookies[i].indexOf("="));
        var y = _cookies[i].substr(_cookies[i].indexOf("=") + 1);
        x = x.replace(/^\s+|\s+$/g, "");
        if (x == c_name) return unescape(y);
    }

    return null;
};

EditableGrid.prototype.has_local_storage = function () {
    try { return 'localStorage' in window && window['localStorage'] !== null; } catch (e) { return false; }
};

EditableGrid.prototype._localset = function (key, value) {
    if (this.has_local_storage()) localStorage.setItem(key, value);
    else this.setCookie(key, value, null);
};

EditableGrid.prototype._localunset = function (key) {
    if (this.has_local_storage()) localStorage.removeItem(key);
    else this.setCookie(key, null, null);
};

EditableGrid.prototype._localget = function (key) {
    if (this.has_local_storage()) return localStorage.getItem(key);
    return this.getCookie(key);
};

EditableGrid.prototype._localisset = function (key) {
    if (this.has_local_storage()) return localStorage.getItem(key) !== null && localStorage.getItem(key) != 'undefined';
    return this.getCookie(key) !== null;
};

EditableGrid.prototype.localset = function (key, value) {
    if (this.enableStore) return this._localset(this.name + '_' + key, value);
};

EditableGrid.prototype.localunset = function (key) {
    if (this.enableStore) return this._localunset(this.name + '_' + key, value);
};

EditableGrid.prototype.localget = function (key) {
    return this.enableStore ? this._localget(this.name + '_' + key) : null;
};

EditableGrid.prototype.localisset = function (key) {
    return this.enableStore ? this._localget(this.name + '_' + key) !== null : false;
};

EditableGrid.prototype.unsort = function (a, b) {
    // at index 2 we have the originalIndex
    aa = isNaN(a[2]) ? 0 : parseFloat(a[2]);
    bb = isNaN(b[2]) ? 0 : parseFloat(b[2]);
    return aa - bb;
};

/**
 * returns a sort function which further sorts according to the original index
 * this ensures the sort will always be stable
 * used to sort a tree where only the first level is actually sorted
 */
EditableGrid.prototype.sort_stable = function (sort_function, descending) {
    return function (a, b) {
        var sort = descending ? sort_function(b, a) : sort_function(a, b);
        if (sort != 0) return sort;
        return EditableGrid.prototype.unsort(a, b);
    };
};

EditableGrid.prototype.sort_numeric = function (a, b) {
    aa = isNaN(parseFloat(a[0])) ? 0 : parseFloat(a[0]);
    bb = isNaN(parseFloat(b[0])) ? 0 : parseFloat(b[0]);
    return aa - bb;
};

EditableGrid.prototype.sort_boolean = function (a, b) {
    aa = !a[0] || a[0] == "false" ? 0 : 1;
    bb = !b[0] || b[0] == "false" ? 0 : 1;
    return aa - bb;
};

EditableGrid.prototype.sort_alpha = function (a, b) {
    if (!a[0] && !b[0]) return 0;
    if (a[0] && !b[0]) return 1;
    if (!a[0] && b[0]) return -1;
    if (a[0].toLowerCase() == b[0].toLowerCase()) return 0;
    return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
};

EditableGrid.prototype.sort_date = function (a, b) {
    date = EditableGrid.prototype.checkDate(a[0]);
    aa = typeof date == "object" ? date.sortDate : 0;
    date = EditableGrid.prototype.checkDate(b[0]);
    bb = typeof date == "object" ? date.sortDate : 0;
    return aa - bb;
};

/**
 * Returns computed style property for element
 * @private
 */
EditableGrid.prototype.getStyle = function (element, stylePropCamelStyle, stylePropCSSStyle) {
    stylePropCSSStyle = stylePropCSSStyle || stylePropCamelStyle;
    if (element.currentStyle) return element.currentStyle[stylePropCamelStyle];
    else if (window.getComputedStyle) return document.defaultView.getComputedStyle(element, null).getPropertyValue(stylePropCSSStyle);
    return element.style[stylePropCamelStyle];
};

/**
 * Returns true if the element has a static positioning
 * @private
 */
EditableGrid.prototype.isStatic = function (element) {
    var position = this.getStyle(element, 'position');
    return (!position || position == "static");
};

EditableGrid.prototype.verticalAlign = function (element) {
    return this.getStyle(element, "verticalAlign", "vertical-align");
};

EditableGrid.prototype.paddingLeft = function (element) {
    var padding = parseInt(this.getStyle(element, "paddingLeft", "padding-left"));
    return isNaN(padding) ? 0 : Math.max(0, padding);
};

EditableGrid.prototype.paddingRight = function (element) {
    var padding = parseInt(this.getStyle(element, "paddingRight", "padding-right"));
    return isNaN(padding) ? 0 : Math.max(0, padding);
};

EditableGrid.prototype.paddingTop = function (element) {
    var padding = parseInt(this.getStyle(element, "paddingTop", "padding-top"));
    return isNaN(padding) ? 0 : Math.max(0, padding);
};

EditableGrid.prototype.paddingBottom = function (element) {
    var padding = parseInt(this.getStyle(element, "paddingBottom", "padding-bottom"));
    return isNaN(padding) ? 0 : Math.max(0, padding);
};

EditableGrid.prototype.borderLeft = function (element) {
    var border_l = parseInt(this.getStyle(element, "borderRightWidth", "border-right-width"));
    var border_r = parseInt(this.getStyle(element, "borderLeftWidth", "border-left-width"));
    border_l = isNaN(border_l) ? 0 : border_l;
    border_r = isNaN(border_r) ? 0 : border_r;
    return Math.max(border_l, border_r);
};

EditableGrid.prototype.borderRight = function (element) {
    return this.borderLeft(element);
};

EditableGrid.prototype.borderTop = function (element) {
    var border_t = parseInt(this.getStyle(element, "borderTopWidth", "border-top-width"));
    var border_b = parseInt(this.getStyle(element, "borderBottomWidth", "border-bottom-width"));
    border_t = isNaN(border_t) ? 0 : border_t;
    border_b = isNaN(border_b) ? 0 : border_b;
    return Math.max(border_t, border_b);
};

EditableGrid.prototype.borderBottom = function (element) {
    return this.borderTop(element);
};

/**
 * Returns auto width for editor
 * @private
 */
EditableGrid.prototype.autoWidth = function (element) {
    return element.offsetWidth - this.paddingLeft(element) - this.paddingRight(element) - this.borderLeft(element) - this.borderRight(element);
};

/**
 * Returns auto height for editor
 * @private
 */
EditableGrid.prototype.autoHeight = function (element) {
    return element.offsetHeight - this.paddingTop(element) - this.paddingBottom(element) - this.borderTop(element) - this.borderBottom(element);
};

/**
 * Detects the directory when the js sources can be found
 * @private
 */
EditableGrid.prototype.detectDir = function () {
    var base = location.href;
    var e = document.getElementsByTagName('base');
    for (var i = 0; i < e.length; i++) if (e[i].href) base = e[i].href;

    e = document.getElementsByTagName('script');
    for (var i = 0; i < e.length; i++) {
        if (e[i].src && /(^|\/)editablegrid[^\/]*\.js([?#].*)?$/i.test(e[i].src)) {
            var src = new URI(e[i].src);
            var srcAbs = src.toAbsolute(base);
            srcAbs.path = srcAbs.path.replace(/[^\/]+$/, ''); // remove filename
            srcAbs.path = srcAbs.path.replace(/\/$/, ''); // remove trailing slash
            delete srcAbs.query;
            delete srcAbs.fragment;
            return srcAbs.toString();
        }
    }

    return false;
};

/**
 * Detect is 2 values are exactly the same (type and value). Numeric NaN are considered the same.
 * @param v1
 * @param v2
 * @return boolean
 */
EditableGrid.prototype.isSame = function (v1, v2) {
    if (v1 === v2) return true;
    if (typeof v1 == 'number' && isNaN(v1) && typeof v2 == 'number' && isNaN(v2)) return true;
    if (v1 === '' && v2 === null) return true;
    if (v2 === '' && v1 === null) return true;
    return false;
};

/**
 * class name manipulation
 * @private
 */
EditableGrid.prototype.strip = function (str) { return str.replace(/^\s+/, '').replace(/\s+$/, ''); };
EditableGrid.prototype.hasClassName = function (element, className) { return (element.className.length > 0 && (element.className == className || new RegExp("(^|\\s)" + className.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&") + "(\\s|$)").test(element.className))); };
EditableGrid.prototype.addClassName = function (element, className) { if (!this.hasClassName(element, className)) element.className += (element.className ? ' ' : '') + className; };
EditableGrid.prototype.removeClassName = function (element, className) { element.className = this.strip(element.className.replace(new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ')); };

/**
 * Useful string methods 
 * @private
 */
String.prototype.trim = function () { return (this.replace(/^[\s\xA0]+/, "").replace(/[\s\xA0]+$/, "")); };
String.prototype.contains = function (str) { return (this.match(str) == str); };
if (!String.prototype.hasOwnProperty("startsWith")) {
    String.prototype.startsWith = function (str) { return (this.match("^" + str) == str); };
}
String.prototype.endsWith = function (str) { return (this.match(str + "$") == str); };

//Accepted formats: (for EU just switch month and day)

//mm-dd-yyyy
//mm/dd/yyyy
//mm.dd.yyyy
//mm dd yyyy
//mmm dd yyyy
//mmddyyyy

//m-d-yyyy
//m/d/yyyy
//m.d.yyyy,
//m d yyyy
//mmm d yyyy

////m-d-yy
////m/d/yy
////m.d.yy
////m d yy,
////mmm d yy (yy is 20yy) 

/**
 * Checks validity of a date string 
 * @private
 */
EditableGrid.prototype.checkDate = function (strDate, strDatestyle) {
    strDatestyle = strDatestyle || this.dateFormat;
    strDatestyle = strDatestyle || "EU";

    var strDateArray;
    var strDay;
    var strMonth;
    var strYear;
    var intday;
    var intMonth;
    var intYear;
    var booFound = false;
    var strSeparatorArray = new Array("-", " ", "/", ".");
    var intElementNr;
    var err = 0;

    var strMonthArray = this.shortMonthNames;
    strMonthArray = strMonthArray || ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (!strDate || strDate.length < 1) return 0;

    for (intElementNr = 0; intElementNr < strSeparatorArray.length; intElementNr++) {
        if (strDate.indexOf(strSeparatorArray[intElementNr]) != -1) {
            strDateArray = strDate.split(strSeparatorArray[intElementNr]);
            if (strDateArray.length != 3) return 1;
            else {
                strDay = strDateArray[0];
                strMonth = strDateArray[1];
                strYear = strDateArray[2];
            }
            booFound = true;
        }
    }

    if (booFound == false) {
        if (strDate.length <= 5) return 1;
        strDay = strDate.substr(0, 2);
        strMonth = strDate.substr(2, 2);
        strYear = strDate.substr(4);
    }

    // if (strYear.length == 2) strYear = '20' + strYear;

    // US style
    if (strDatestyle == "US") {
        strTemp = strDay;
        strDay = strMonth;
        strMonth = strTemp;
    }

    // get and check day
    intday = parseInt(strDay, 10);
    if (isNaN(intday)) return 2;

    // get and check month
    intMonth = parseInt(strMonth, 10);
    if (isNaN(intMonth)) {
        for (i = 0; i < 12; i++) {
            if (strMonth.toUpperCase() == strMonthArray[i].toUpperCase()) {
                intMonth = i + 1;
                strMonth = strMonthArray[i];
                i = 12;
            }
        }
        if (isNaN(intMonth)) return 3;
    }
    if (intMonth > 12 || intMonth < 1) return 5;

    // get and check year
    intYear = parseInt(strYear, 10);
    if (isNaN(intYear)) return 4;
    if (intYear < 70) { intYear = 2000 + intYear; strYear = '' + intYear; } // 70 become 1970, 69 becomes 1969, as with PHP's date_parse_from_format
    if (intYear < 100) { intYear = 1900 + intYear; strYear = '' + intYear; }
    if (intYear < 1900 || intYear > 2100) return 11;

    // check day in month
    if ((intMonth == 1 || intMonth == 3 || intMonth == 5 || intMonth == 7 || intMonth == 8 || intMonth == 10 || intMonth == 12) && (intday > 31 || intday < 1)) return 6;
    if ((intMonth == 4 || intMonth == 6 || intMonth == 9 || intMonth == 11) && (intday > 30 || intday < 1)) return 7;
    if (intMonth == 2) {
        if (intday < 1) return 8;
        if (LeapYear(intYear) == true) { if (intday > 29) return 9; }
        else if (intday > 28) return 10;
    }

    // return formatted date
    return {
        formattedDate: (strDatestyle == "US" ? strMonthArray[intMonth - 1] + " " + intday + " " + strYear : intday + " " + strMonthArray[intMonth - 1]/*.toLowerCase()*/ + " " + strYear),
        sortDate: Date.parse(intMonth + "/" + intday + "/" + intYear),
        dbDate: intYear + "-" + intMonth + "-" + intday
    };
};

function LeapYear(intYear) {
    if (intYear % 100 == 0) { if (intYear % 400 == 0) return true; }
    else if ((intYear % 4) == 0) return true;
    return false;
}

//See RFC3986
URI = function (uri) {
    this.scheme = null;
    this.authority = null;
    this.path = '';
    this.query = null;
    this.fragment = null;

    this.parse = function (uri) {
        var m = uri.match(/^(([A-Za-z][0-9A-Za-z+.-]*)(:))?((\/\/)([^\/?#]*))?([^?#]*)((\?)([^#]*))?((#)(.*))?/);
        this.scheme = m[3] ? m[2] : null;
        this.authority = m[5] ? m[6] : null;
        this.path = m[7];
        this.query = m[9] ? m[10] : null;
        this.fragment = m[12] ? m[13] : null;
        return this;
    };

    this.toString = function () {
        var result = '';
        if (this.scheme != null) result = result + this.scheme + ':';
        if (this.authority != null) result = result + '//' + this.authority;
        if (this.path != null) result = result + this.path;
        if (this.query != null) result = result + '?' + this.query;
        if (this.fragment != null) result = result + '#' + this.fragment;
        return result;
    };

    this.toAbsolute = function (base) {
        var base = new URI(base);
        var r = this;
        var t = new URI;

        if (base.scheme == null) return false;

        if (r.scheme != null && r.scheme.toLowerCase() == base.scheme.toLowerCase()) {
            r.scheme = null;
        }

        if (r.scheme != null) {
            t.scheme = r.scheme;
            t.authority = r.authority;
            t.path = removeDotSegments(r.path);
            t.query = r.query;
        } else {
            if (r.authority != null) {
                t.authority = r.authority;
                t.path = removeDotSegments(r.path);
                t.query = r.query;
            } else {
                if (r.path == '') {
                    t.path = base.path;
                    if (r.query != null) {
                        t.query = r.query;
                    } else {
                        t.query = base.query;
                    }
                } else {
                    if (r.path.substr(0, 1) == '/') {
                        t.path = removeDotSegments(r.path);
                    } else {
                        if (base.authority != null && base.path == '') {
                            t.path = '/' + r.path;
                        } else {
                            t.path = base.path.replace(/[^\/]+$/, '') + r.path;
                        }
                        t.path = removeDotSegments(t.path);
                    }
                    t.query = r.query;
                }
                t.authority = base.authority;
            }
            t.scheme = base.scheme;
        }
        t.fragment = r.fragment;

        return t;
    };

    function removeDotSegments(path) {
        var out = '';
        while (path) {
            if (path.substr(0, 3) == '../' || path.substr(0, 2) == './') {
                path = path.replace(/^\.+/, '').substr(1);
            } else if (path.substr(0, 3) == '/./' || path == '/.') {
                path = '/' + path.substr(3);
            } else if (path.substr(0, 4) == '/../' || path == '/..') {
                path = '/' + path.substr(4);
                out = out.replace(/\/?[^\/]*$/, '');
            } else if (path == '.' || path == '..') {
                path = '';
            } else {
                var rm = path.match(/^\/?[^\/]*/)[0];
                path = path.substr(rm.length);
                out = out + rm;
            }
        }
        return out;
    }

    if (uri) {
        this.parse(uri);
    }
};

function get_html_translation_table(table, quote_style) {
    // http://kevin.vanzonneveld.net
    // +   original by: Philip Peterson
    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: noname
    // +   bugfixed by: Alex
    // +   bugfixed by: Marco
    // +   bugfixed by: madipta
    // +   improved by: KELAN
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
    // +      input by: Frank Forte
    // +   bugfixed by: T.Wild
    // +      input by: Ratheous
    // %          note: It has been decided that we're not going to add global
    // %          note: dependencies to php.js, meaning the constants are not
    // %          note: real constants, but strings instead. Integers are also supported if someone
    // %          note: chooses to create the constants themselves.
    // *     example 1: get_html_translation_table('HTML_SPECIALCHARS');
    // *     returns 1: {'"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'}

    var entities = {}, hash_map = {}, decimal = 0, symbol = '';
    var constMappingTable = {}, constMappingQuoteStyle = {};
    var useTable = {}, useQuoteStyle = {};

    // Translate arguments
    constMappingTable[0] = 'HTML_SPECIALCHARS';
    constMappingTable[1] = 'HTML_ENTITIES';
    constMappingQuoteStyle[0] = 'ENT_NOQUOTES';
    constMappingQuoteStyle[2] = 'ENT_COMPAT';
    constMappingQuoteStyle[3] = 'ENT_QUOTES';

    useTable = !isNaN(table) ? constMappingTable[table] : table ? table.toUpperCase() : 'HTML_SPECIALCHARS';
    useQuoteStyle = !isNaN(quote_style) ? constMappingQuoteStyle[quote_style] : quote_style ? quote_style.toUpperCase() : 'ENT_COMPAT';

    if (useTable !== 'HTML_SPECIALCHARS' && useTable !== 'HTML_ENTITIES') {
        throw new Error("Table: " + useTable + ' not supported');
        // return false;
    }

    if (useTable === 'HTML_ENTITIES') {
        entities['160'] = '&nbsp;';
        entities['161'] = '&iexcl;';
        entities['162'] = '&cent;';
        entities['163'] = '&pound;';
        entities['164'] = '&curren;';
        entities['165'] = '&yen;';
        entities['166'] = '&brvbar;';
        entities['167'] = '&sect;';
        entities['168'] = '&uml;';
        entities['169'] = '&copy;';
        entities['170'] = '&ordf;';
        entities['171'] = '&laquo;';
        entities['172'] = '&not;';
        entities['173'] = '&shy;';
        entities['174'] = '&reg;';
        entities['175'] = '&macr;';
        entities['176'] = '&deg;';
        entities['177'] = '&plusmn;';
        entities['178'] = '&sup2;';
        entities['179'] = '&sup3;';
        entities['180'] = '&acute;';
        entities['181'] = '&micro;';
        entities['182'] = '&para;';
        entities['183'] = '&middot;';
        entities['184'] = '&cedil;';
        entities['185'] = '&sup1;';
        entities['186'] = '&ordm;';
        entities['187'] = '&raquo;';
        entities['188'] = '&frac14;';
        entities['189'] = '&frac12;';
        entities['190'] = '&frac34;';
        entities['191'] = '&iquest;';
        entities['192'] = '&Agrave;';
        entities['193'] = '&Aacute;';
        entities['194'] = '&Acirc;';
        entities['195'] = '&Atilde;';
        entities['196'] = '&Auml;';
        entities['197'] = '&Aring;';
        entities['198'] = '&AElig;';
        entities['199'] = '&Ccedil;';
        entities['200'] = '&Egrave;';
        entities['201'] = '&Eacute;';
        entities['202'] = '&Ecirc;';
        entities['203'] = '&Euml;';
        entities['204'] = '&Igrave;';
        entities['205'] = '&Iacute;';
        entities['206'] = '&Icirc;';
        entities['207'] = '&Iuml;';
        entities['208'] = '&ETH;';
        entities['209'] = '&Ntilde;';
        entities['210'] = '&Ograve;';
        entities['211'] = '&Oacute;';
        entities['212'] = '&Ocirc;';
        entities['213'] = '&Otilde;';
        entities['214'] = '&Ouml;';
        entities['215'] = '&times;';
        entities['216'] = '&Oslash;';
        entities['217'] = '&Ugrave;';
        entities['218'] = '&Uacute;';
        entities['219'] = '&Ucirc;';
        entities['220'] = '&Uuml;';
        entities['221'] = '&Yacute;';
        entities['222'] = '&THORN;';
        entities['223'] = '&szlig;';
        entities['224'] = '&agrave;';
        entities['225'] = '&aacute;';
        entities['226'] = '&acirc;';
        entities['227'] = '&atilde;';
        entities['228'] = '&auml;';
        entities['229'] = '&aring;';
        entities['230'] = '&aelig;';
        entities['231'] = '&ccedil;';
        entities['232'] = '&egrave;';
        entities['233'] = '&eacute;';
        entities['234'] = '&ecirc;';
        entities['235'] = '&euml;';
        entities['236'] = '&igrave;';
        entities['237'] = '&iacute;';
        entities['238'] = '&icirc;';
        entities['239'] = '&iuml;';
        entities['240'] = '&eth;';
        entities['241'] = '&ntilde;';
        entities['242'] = '&ograve;';
        entities['243'] = '&oacute;';
        entities['244'] = '&ocirc;';
        entities['245'] = '&otilde;';
        entities['246'] = '&ouml;';
        entities['247'] = '&divide;';
        entities['248'] = '&oslash;';
        entities['249'] = '&ugrave;';
        entities['250'] = '&uacute;';
        entities['251'] = '&ucirc;';
        entities['252'] = '&uuml;';
        entities['253'] = '&yacute;';
        entities['254'] = '&thorn;';
        entities['255'] = '&yuml;';
    }

    if (useQuoteStyle !== 'ENT_NOQUOTES') {
        entities['34'] = '&quot;';
    }
    if (useQuoteStyle === 'ENT_QUOTES') {
        entities['39'] = '&#39;';
    }
    entities['60'] = '&lt;';
    entities['62'] = '&gt;';


    // ascii decimals to real symbols
    for (decimal in entities) {
        symbol = String.fromCharCode(decimal);
        hash_map[symbol] = entities[decimal];
    }

    return hash_map;
}

function htmlentities(string, quote_style) {
    var hash_map = {}, symbol = '', tmp_str = '';
    tmp_str = string.toString();
    if (false === (hash_map = this.get_html_translation_table('HTML_ENTITIES', quote_style))) return false;
    tmp_str = tmp_str.split('&').join('&amp;'); // replace & first, otherwise & in htlm codes will be replaced too!
    hash_map["'"] = '&#039;';
    for (symbol in hash_map) tmp_str = tmp_str.split(symbol).join(hash_map[symbol]);
    return tmp_str;
}

function htmlspecialchars(string, quote_style) {
    var hash_map = {}, symbol = '', tmp_str = '';
    tmp_str = string.toString();
    if (false === (hash_map = this.get_html_translation_table('HTML_SPECIALCHARS', quote_style))) return false;
    tmp_str = tmp_str.split('&').join('&amp;'); // replace & first, otherwise & in htlm codes will be replaced too!
    for (symbol in hash_map) tmp_str = tmp_str.split(symbol).join(hash_map[symbol]);
    return tmp_str;
}

function number_format(number, decimals, dec_point, thousands_sep) {
    // http://kevin.vanzonneveld.net
    // +   original by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +     bugfix by: Michael White (http://getsprink.com)
    // +     bugfix by: Benjamin Lupton
    // +     bugfix by: Allan Jensen (http://www.winternet.no)
    // +    revised by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // +     bugfix by: Howard Yeend
    // +    revised by: Luke Smith (http://lucassmith.name)
    // +     bugfix by: Diogo Resende
    // +     bugfix by: Rival
    // +      input by: Kheang Hok Chin (http://www.distantia.ca/)
    // +   improved by: davook
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +      input by: Jay Klehr
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +      input by: Amir Habibi (http://www.residence-mixte.com/)
    // +     bugfix by: Brett Zamir (http://brett-zamir.me)
    // +   improved by: Theriault
    // +      input by: Amirouche
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // *     example 1: number_format(1234.56);
    // *     returns 1: '1,235'
    // *     example 2: number_format(1234.56, 2, ',', ' ');
    // *     returns 2: '1 234,56'
    // *     example 3: number_format(1234.5678, 2, '.', '');
    // *     returns 3: '1234.57'
    // *     example 4: number_format(67, 2, ',', '.');
    // *     returns 4: '67,00'
    // *     example 5: number_format(1000);
    // *     returns 5: '1,000'
    // *     example 6: number_format(67.311, 2);
    // *     returns 6: '67.31'
    // *     example 7: number_format(1000.55, 1);
    // *     returns 7: '1,000.6'
    // *     example 8: number_format(67000, 5, ',', '.');
    // *     returns 8: '67.000,00000'
    // *     example 9: number_format(0.9, 0);
    // *     returns 9: '1'
    // *    example 10: number_format('1.20', 2);
    // *    returns 10: '1.20'
    // *    example 11: number_format('1.20', 4);
    // *    returns 11: '1.2000'
    // *    example 12: number_format('1.2000', 3);
    // *    returns 12: '1.200'
    // *    example 13: number_format('1 000,50', 2, '.', ' ');
    // *    returns 13: '100 050.00'
    // Strip all characters but numerical ones.
    number = (number + '').replace(/[^0-9+\-Ee.]/g, '');
    var n = !isFinite(+number) ? 0 : +number,
        prec = !isFinite(+decimals) ? 0 : /*Math.abs(*/decimals/*)*/,
        sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
        dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
        s = '',
        toFixedFix = function (n, prec) {
            var k = Math.pow(10, prec);
            return '' + Math.round(n * k) / k;
        };
    // Fix for IE parseFloat(0.55).toFixed(0) = 0;
    s = (prec < 0 ? ('' + n) : (prec ? toFixedFix(n, prec) : '' + Math.round(n))).split('.');
    if (s[0].length > 3) {
        s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
    }
    if ((s[1] || '').length < prec) {
        s[1] = s[1] || '';
        s[1] += new Array(prec - s[1].length + 1).join('0');
    }
    return s.join(dec);
}

/**
 * Abstract cell validator
 * @constructor
 * @class Base class for all cell validators
 */

function CellValidator(config) {
    // default properties
    var props = { isValid: null };

    // override default properties with the ones given
    for (var p in props) if (typeof config != 'undefined' && typeof config[p] != 'undefined') this[p] = config[p];
}

CellValidator.prototype.isValid = function (value) {
    return true;
};

/**
 * Number cell validator
 * @constructor
 * @class Class to validate a numeric cell
 */

function NumberCellValidator(type) { this.type = type; }
NumberCellValidator.prototype = new CellValidator;
NumberCellValidator.prototype.isValid = function (value) {
    // check that it is a valid number
    if (isNaN(value)) return false;

    // for integers check that it's not a float
    if (this.type == "integer" && value != "" && parseInt(value) != parseFloat(value)) return false;

    // the integer or double is valid
    return true;
};

/**
 * Email cell validator
 * @constructor
 * @class Class to validate a cell containing an email
 */

function EmailCellValidator() { }
EmailCellValidator.prototype = new CellValidator;
EmailCellValidator.prototype.isValid = function (value) { return value == "" || /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/.test(value); };

/**
 * Website cell validator
 * @constructor
 * @class Class to validate a cell containing a website
 */

function WebsiteCellValidator() { }
WebsiteCellValidator.prototype = new CellValidator;
WebsiteCellValidator.prototype.isValid = function (value) { return value == "" || (value.indexOf(".") > 0 && value.indexOf(".") < (value.length - 2)); };

/**
 * Date cell validator
 * @constructor
 * @augments CellValidator
 * @class Class to validate a cell containing a date
 */

function DateCellValidator(grid) { this.grid = grid; }
DateCellValidator.prototype = new CellValidator;

DateCellValidator.prototype.isValid = function (value) {
    return value == "" || typeof this.grid.checkDate(value) == "object";
};

/**
 * Abstract cell renderer
 * @constructor
 * @class Base class for all cell renderers
 * @param {Object} config
 */

function CellRenderer(config) { this.init(config); }

CellRenderer.prototype.init = function (config) {
    // override default properties with the ones given
    for (var p in config) this[p] = config[p];
};

CellRenderer.prototype._render = function (rowIndex, columnIndex, element, value) {
    // remember all the things we need
    element.rowIndex = rowIndex;
    element.columnIndex = columnIndex;

    // remove existing content	
    while (element.hasChildNodes()) element.removeChild(element.firstChild);

    // clear isEditing (in case a currently editeed is being re-rendered by some external call)
    element.isEditing = false;

    // always apply the number class to numerical cells and column headers
    if (this.column.isNumerical()) EditableGrid.prototype.addClassName(element, "number");

    // always apply the boolean class to boolean column headers
    if (this.column.datatype == 'boolean') EditableGrid.prototype.addClassName(element, "boolean");

    // apply a css class corresponding to the column name
    EditableGrid.prototype.addClassName(element, "editablegrid-" + this.column.name);

    // add a data-title attribute used for responsiveness
    element.setAttribute('data-title', this.column.label);

    // call the specialized render method
    return this.render(element, typeof value == 'string' && this.column.datatype != "html" ? (value === null ? null : htmlspecialchars(value, 'ENT_NOQUOTES').replace(/  /g, ' &nbsp;')) : value);
};

CellRenderer.prototype.render = function (element, value, escapehtml) {
    var _value = escapehtml ? (typeof value == 'string' && this.column.datatype != "html" ? (value === null ? null : htmlspecialchars(value, 'ENT_NOQUOTES').replace(/  /g, ' &nbsp;')) : value) : value;
    element.innerHTML = _value ? _value : "";
};

CellRenderer.prototype.getDisplayValue = function (rowIndex, value) {
    return value;
};

/**
 * Enum cell renderer
 * @constructor
 * @class Class to render a cell with enum values
 */

function EnumCellRenderer(config) { this.init(config); }
EnumCellRenderer.prototype = new CellRenderer();
EnumCellRenderer.prototype.getLabel = function (rowIndex, value) {
    var label = null;
    if (typeof value != 'undefined') {
        value = value ? value : '';
        var optionValues = this.column.getOptionValuesForRender(rowIndex);
        if (optionValues && value in optionValues) label = optionValues[value];
        if (label === null) {
            var isNAN = typeof value == 'number' && isNaN(value);
            label = isNAN ? "" : value;
        }
    }
    return label ? label : '';
};

EnumCellRenderer.prototype.render = function (element, value) {
    var label = this.getLabel(element.rowIndex, value);
    element.innerHTML = label ? (this.column.datatype != "html" ? htmlspecialchars(label, 'ENT_NOQUOTES').replace(/\s\s/g, '&nbsp; ') : label) : '';
};

EnumCellRenderer.prototype.getDisplayValue = function (rowIndex, value) {
    // if the column has enumerated values, sort and filter on the value label
    return value === null ? null : this.getLabel(rowIndex, value);
};

/**
 * Number cell renderer
 * @constructor
 * @class Class to render a cell with numerical values
 */

function NumberCellRenderer(config) { this.init(config); }
NumberCellRenderer.prototype = new CellRenderer();
NumberCellRenderer.prototype.render = function (element, value) {
    var column = this.column || {}; // in case somebody calls new NumberCellRenderer().render(..)

    var isNAN = value === null || (typeof value == 'number' && isNaN(value));
    var displayValue = isNAN ? (column.nansymbol || "") : value;
    if (typeof displayValue == 'number') {

        if (column.precision !== null) {
            // displayValue = displayValue.toFixed(column.precision);
            displayValue = number_format(displayValue, column.precision, column.decimal_point, column.thousands_separator);
        }

        if (column.unit !== null) {
            if (column.unit_before_number) displayValue = column.unit + ' ' + displayValue;
            else displayValue = displayValue + ' ' + column.unit;
        }
    }

    element.innerHTML = displayValue;
    if (isNAN) EditableGrid.prototype.addClassName(element, "nan");
    else EditableGrid.prototype.removeClassName(element, "nan");
};

/**
 * Checkbox cell renderer
 * @constructor
 * @class Class to render a cell with an HTML checkbox
 */

function CheckboxCellRenderer(config) { this.init(config); }
CheckboxCellRenderer.prototype = new CellRenderer();

CheckboxCellRenderer.prototype._render = function (rowIndex, columnIndex, element, value) {
    // if a checkbox already exists keep it, otherwise clear current content
    if (element.firstChild && (typeof element.firstChild.getAttribute != "function" || element.firstChild.getAttribute("type") != "checkbox"))
        while (element.hasChildNodes()) element.removeChild(element.firstChild);

    // remember all the things we need
    element.rowIndex = rowIndex;
    element.columnIndex = columnIndex;

    // apply a css class corresponding to the column name
    EditableGrid.prototype.addClassName(element, "editablegrid-" + this.column.name);

    // add a data-title attribute used for responsiveness
    element.setAttribute('data-title', this.column.label);

    // call the specialized render method
    return this.render(element, value);
};

CheckboxCellRenderer.prototype.render = function (element, value) {
    // convert value to boolean just in case
    value = (value && value != 0 && value != "false") ? true : false;

    // if check box already created, just update its state
    if (element.firstChild) { element.firstChild.checked = value; return; }

    // create and initialize checkbox
    var htmlInput = document.createElement("input");
    htmlInput.setAttribute("type", "checkbox");

    // give access to the cell editor and element from the editor field
    htmlInput.element = element;
    htmlInput.cellrenderer = this;

    // this renderer is a little special because it allows direct edition
    var cellEditor = new CellEditor();
    cellEditor.editablegrid = this.editablegrid;
    cellEditor.column = this.column;
    htmlInput.onclick = function (event) {
        element.rowIndex = this.cellrenderer.editablegrid.getRowIndex(element.parentNode); // in case it has changed due to sorting or remove
        element.isEditing = true;
        cellEditor.applyEditing(element, htmlInput.checked ? true : false);
    };

    element.appendChild(htmlInput);
    htmlInput.checked = value;
    htmlInput.disabled = (!this.column.editable || !this.editablegrid.isEditable(element.rowIndex, element.columnIndex));

    EditableGrid.prototype.addClassName(element, "boolean");
};

/**
 * Email cell renderer
 * @constructor
 * @class Class to render a cell with emails
 */

function EmailCellRenderer(config) { this.init(config); }
EmailCellRenderer.prototype = new CellRenderer();
EmailCellRenderer.prototype.render = function (element, value) {
    element.innerHTML = value ? "<a href='mailto:" + value + "'>" + value + "</a>" : "";
};

/**
 * ArrayCellRenderer cell renderer
 * @constructor
 * @class Class to render a cell with emails
 */

function ArrayCellRenderer(config) { this.init(config); }
ArrayCellRenderer.prototype = new CellRenderer();
ArrayCellRenderer.prototype.render = function (element, value) {
    //join the array into a CSV	
    element.innerHTML = value.join(",");
};

/**
 * Hashtag cell renderer
 * @constructor
 * @class Class to render a cell with emails
 */

function HashtagCellRenderer(config) { this.init(config); }
HashtagCellRenderer.prototype = new CellRenderer();
HashtagCellRenderer.prototype.render = function (element, dataobj) {
    //TODO clean up this code to not be so haphazard
    var value = (typeof dataobj === "string") ? dataobj : dataobj.desc;
    var comment = (typeof dataobj === "string") ? null : dataobj.comment;
    //take the value and add SPAN
    //split on space
    //if starts with #, wrap with SPAN
    //put those pieces back together
    var _ = require("lodash");
    var output = [];
    _.each(value.split(" "), function (item) {
        switch (item[0]) {

            case "#":
                item = "<span data-type=tags class=\"label label-primary label-search\">" + item.substring(1) + "</span>";
                break;
            case "@":
                item = "<span data-type=status class=\"label label-info label-search\">" + item.substring(1) + "</span>";
                break;
            case "!":
                item = "<span data-type=milestone class=\"label label-warning label-search\">" + item.substring(1) + "</span>";
                break;
        }
        output.push(item);
    })

    var innerHTML = output.join(" ");

    //this will add the comment to the rendering
    //TODO add some classes and style this better
    if (comment != null) {
        innerHTML += "<p><i>" + comment + "</i></p>"
    }
    element.innerHTML = innerHTML;
};

/**
 * ActionCellRenderer cell renderer
 * @constructor
 * @class Class to render a cell with actions
 */

function ActionCellRenderer(config) { this.init(config); }
ActionCellRenderer.prototype = new CellRenderer();
ActionCellRenderer.prototype.render = function (element, value) {
    //return a set of buttons to be wired up elsewhere
    var innerHTML = `<div class="btn-group">
				<button type="button" class="btn btn-default btn-xs btnComplete" aria-label="Left Align">
					<span class="glyphicon glyphicon-ok" aria-hidden="true"></span>
				</button>
				<button type="button" class="btn btn-default btn-xs btnDelete" aria-label="Left Align">
					<span class="glyphicon glyphicon-trash" aria-hidden="true"></span>
				</button>

				<button type="button" class="btn btn-default btn-xs btnComment" aria-label="Left Align">
					<span class="glyphicon glyphicon-comment" aria-hidden="true"></span>
				</button>
				<button type="button" class="btn btn-default btn-xs btnIsolate" aria-label="Left Align">
					<span class="glyphicon glyphicon-log-in" aria-hidden="true"></span>
				</button>					

				<div class="btn-group">
					<button type="button" class="btn btn-default btn-xs dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
						<span class="glyphicon glyphicon-arrow-right" aria-hidden="true"></span>
					</button>
					<ul class="dropdown-menu gridMove" aria-labelledby="dropdownMenu1">
					</ul>
				</div>
			</div>`
    element.innerHTML = innerHTML;
};

/**
 * Website cell renderer
 * @constructor
 * @class Class to render a cell with websites
 */

function WebsiteCellRenderer(config) { this.init(config); }
WebsiteCellRenderer.prototype = new CellRenderer();
WebsiteCellRenderer.prototype.render = function (element, value) {
    element.innerHTML = value ? "<a href='" + (value.indexOf("//") == -1 ? "http://" + value : value) + "'>" + value + "</a>" : "";
};

/**
 * Date cell renderer
 * @constructor
 * @class Class to render a cell containing a date
 */

function DateCellRenderer(config) { this.init(config); }
DateCellRenderer.prototype = new CellRenderer;

DateCellRenderer.prototype.render = function (cell, value) {
    var date = this.editablegrid.checkDate(value);
    if (typeof date == "object") cell.innerHTML = date.formattedDate;
    else cell.innerHTML = value ? value : "";
    cell.style.whiteSpace = 'nowrap';
};

/**
 * Sort header renderer
 * @constructor
 * @class Class to add sorting functionalities to headers
 */

function SortHeaderRenderer(columnName, cellRenderer) { this.columnName = columnName; this.cellRenderer = cellRenderer; };
SortHeaderRenderer.prototype = new CellRenderer();
SortHeaderRenderer.prototype.render = function (cell, value) {
    if (!value) { if (this.cellRenderer) this.cellRenderer.render(cell, value); }
    else {

        // create a link that will sort (alternatively ascending/descending)
        var link = document.createElement("a");
        cell.appendChild(link);
        link.columnName = this.columnName;
        link.style.cursor = "pointer";
        link.innerHTML = value;
        link.editablegrid = this.editablegrid;
        link.renderer = this;
        link.onclick = function () {
            with (this.editablegrid) {

                var cols = tHead.rows[0].cells;
                var clearPrevious = -1;
                var backOnFirstPage = false;

                if (sortedColumnName != this.columnName) {
                    clearPrevious = sortedColumnName;
                    sortedColumnName = this.columnName;
                    sortDescending = false;
                    backOnFirstPage = true;
                }
                else {
                    if (!sortDescending) sortDescending = true;
                    else {
                        clearPrevious = sortedColumnName;
                        sortedColumnName = -1;
                        sortDescending = false;
                        backOnFirstPage = true;
                    }
                }

                // render header for previous sort column (not needed anymore since the grid is now fully refreshed after a sort - cf. possible pagination)
                // var j = getColumnIndex(clearPrevious);
                // if (j >= 0) columns[j].headerRenderer._render(-1, j, cols[j], columns[j].label);

                sort(sortedColumnName, sortDescending, backOnFirstPage);

                // render header for new sort column (not needed anymore since the grid is now fully refreshed after a sort - cf. possible pagination)
                // var j = getColumnIndex(sortedColumnName);
                // if (j >= 0) columns[j].headerRenderer._render(-1, j, cols[j], columns[j].label);
            }
        };

        // add an arrow to indicate if sort is ascending or descending
        if (this.editablegrid.sortedColumnName == this.columnName) {
            cell.appendChild(document.createTextNode("\u00a0"));
            cell.appendChild(this.editablegrid.sortDescending ? this.editablegrid.sortDownElement : this.editablegrid.sortUpElement);
        }

        // call user renderer if any
        if (this.cellRenderer) this.cellRenderer.render(cell, value);
    }
};
