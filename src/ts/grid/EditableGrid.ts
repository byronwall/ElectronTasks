import {
  NumberCellValidator,
  EmailCellValidator,
  WebsiteCellValidator,
  DateCellValidator
} from "./Validators";
import {
  EnumCellRenderer,
  NumberCellRenderer,
  CheckboxCellRenderer,
  EmailCellRenderer,
  WebsiteCellRenderer,
  DateCellRenderer,
  HashtagCellRenderer,
  ActionCellRenderer,
  ArrayCellRenderer,
  CellRenderer
} from "./Renderers";
import {
  ArrayCellEditor,
  NumberCellEditor,
  SelectCellEditor,
  TextCellEditor,
  DateCellEditor,
  CellEditor
} from "./Editors";
import { Column } from "./Column";

import * as _ from "lodash";

export function _$(obj: any) {
  return document.getElementById(obj);
}

class EnumProvider {
  getOptionValuesForRender: any;
  getOptionValuesForEdit: any;

  constructor(config = {}) {
    // default properties
    this.getOptionValuesForRender = function(grid, column, rowIndex) {
      return null;
    };
    this.getOptionValuesForEdit = function(grid, column, rowIndex) {
      return null;
    };

    // override default properties with the ones given
    for (var p in config) this[p] = config[p];
  }
}

export class EditableGrid {
  jsData: any;
  nbHeaderRows: any;
  tBody: any;
  name: string;
  lastSelectedRowIndex: any;
  tHead: any;
  table: any;

  //TODO these need to be determined
  data: any;
  columns: any;
  dataUnfiltered: any;
  rawData: any;
  currentContainerid: any;
  currentClassName: any;
  currentTableid: any;

  enableSort: boolean;
  enableStore: boolean;
  doubleclick: boolean;
  editmode: string;
  editorzoneid: string;
  allowSimultaneousEdition: boolean;
  saveOnBlur: boolean;
  invalidClassName: string;
  ignoreLastRow: boolean;
  caption = null;
  dateFormat: string;
  shortMonthNames = null;
  smartColorsBar: string[];
  smartColorsPie: string[];
  pageSize: number;

  //server-side pagination, sorting and filtering
  serverSide: boolean;
  pageCount: number;
  totalRowCount: number;
  unfilteredRowCount: number;
  paginatorAttributes = null;
  lastURL = null;

  constructor(name, config = {}) {
    this.enableSort = true;
    this.enableStore = true;
    this.doubleclick = false;
    this.editmode = "absolute";
    this.editorzoneid = "";
    this.allowSimultaneousEdition = false;
    this.saveOnBlur = true;
    this.invalidClassName = "invalid";
    this.ignoreLastRow = false;
    this.caption = null;
    this.dateFormat = "EU";
    this.shortMonthNames = null;
    this.smartColorsBar = [
      "#dc243c",
      "#4040f6",
      "#00f629",
      "#efe100",
      "#f93fb1",
      "#6f8183",
      "#111111"
    ];
    this.smartColorsPie = [
      "#FF0000",
      "#00FF00",
      "#0000FF",
      "#FFD700",
      "#FF00FF",
      "#00FFFF",
      "#800080"
    ];
    this.pageSize = 0; // client-side pagination, don't set this for server-side pagination!

    //server-side pagination, sorting and filtering
    this.serverSide = false;
    this.pageCount = 0;
    this.totalRowCount = 0;
    this.unfilteredRowCount = 0;
    this.paginatorAttributes = null;
    this.lastURL = null;

    if (typeof name != "undefined" && name.replace(/\s+/g, "") == "")
      console.error("EditableGrid() : parameter [name] cannot be empty.");
    if (name) this.init(name, config);
  }

  init(name, config) {
    if (
      typeof name != "string" ||
      (typeof config != "object" && typeof config != "undefined")
    ) {
      alert(
        "The EditableGrid constructor takes two arguments:\n- name (string)\n- config (object)\n\nGot instead " +
          typeof name +
          " and " +
          typeof config +
          "."
      );
    }

    // override default properties with the ones given
    if (typeof config != "undefined") for (var p in config) this[p] = config[p];

    // private data
    this.name = name;
    this.columns = [];
    this.data = [];
    this.dataUnfiltered = null; // non null means that data is filtered

    this.nbHeaderRows = 1;
    this.lastSelectedRowIndex = -1;

    this.currentContainerid = null;
    this.currentClassName = null;
    this.currentTableid = null;
  }

  /**
     * Callback functions
     */

  tableLoaded() {}
  chartRendered() {}
  tableRendered(containerid, className) {}
  tableSorted(columnIndex, descending) {}
  tableFiltered() {}
  openedCellEditor(rowIndex, columnIndex) {}
  modelChanged(rowIndex, columnIndex, oldValue, newValue, row) {}
  rowSelected(oldRowIndex, newRowIndex) {}
  isHeaderEditable(rowIndex, columnIndex) {
    return false;
  }
  isEditable(rowIndex, columnIndex) {
    return true;
  }
  readonlyWarning() {}
  /** Notifies that a row has been deleted */
  rowRemoved(oldRowIndex, rowId) {}

  //indicates that an editor was blurred
  editorBlurred(rowIndex, columnIndex, element) {}

  //indicates that an editor was cancelled, will allow for task to be deleted
  editorCancelled(rowIndex, columnIndex, element) {}

  _callback(type, callback) {
    if (callback) callback.call(this);
    else {
      this.tableLoaded();
    }
  }

  /**
     * Load metadata and/or data from a Javascript object
     * No callback "tableLoaded" is called since this is a synchronous operation.
     */
  load(object) {
    return this.processJSON(object);
  }

  /**
     * Update and render data for given rows from a Javascript object
     */
  update(object) {
    if (object.data)
      for (var i = 0; i < object.data.length; i++) {
        var row = object.data[i];
        if (!row.id || !row.values) continue;

        // get row to update in our model
        var rowIndex = this.getRowIndex(row.id);
        var rowData = this.data[rowIndex];

        let cellValues;

        // row values can be given as an array (same order as columns) or as an object (associative array)
        if (Object.prototype.toString.call(row.values) !== "[object Array]")
          cellValues = row.values;
        else {
          cellValues = {};
          for (var j = 0; j < row.values.length && j < this.columns.length; j++)
            cellValues[this.columns[j].name] = row.values[j];
        }

        // set all attributes that may have been set in the JSON
        for (var attributeName in row)
          if (attributeName != "id" && attributeName != "values")
            rowData[attributeName] = row[attributeName];

        // get column values for this rows
        rowData.columns = [];
        for (var c = 0; c < this.columns.length; c++) {
          var cellValue =
            this.columns[c].name in cellValues
              ? cellValues[this.columns[c].name]
              : "";
          rowData.columns.push(this.getTypedValue(c, cellValue));
        }

        // render row
        var tr = this.getRow(rowIndex);
        for (var j = 0; j < tr.cells.length && j < this.columns.length; j++)
          if (this.columns[j].renderable)
            this.columns[j].cellRenderer._render(
              rowIndex,
              j,
              tr.cells[j],
              this.getValueAt(rowIndex, j)
            );
        this.tableRendered(this.currentContainerid, this.currentClassName);
      }
  }

  /**
     * Process the JSON content
     * @private
     */
  processJSON(jsonData) {
    if (typeof jsonData == "string") jsonData = eval("(" + jsonData + ")");
    if (!jsonData) return false;

    // clear model and pointer to current table
    this.data = [];

    this.rawData = _.keyBy(jsonData.data, function(item) {
      //TODO remove this array accessor
      return item["id"];
    });
    let rawData = this.rawData;
    this.jsData = jsonData;

    this.dataUnfiltered = null;
    this.table = null;

    // load metadata
    if (jsonData.metadata) {
      // create columns
      this.columns = [];
      for (var c = 0; c < jsonData.metadata.length; c++) {
        var columndata = jsonData.metadata[c];

        var optionValues = columndata.values
          ? EditableGrid._convertOptions(columndata.values)
          : null;
        var optionValuesForRender = null;
        if (optionValues) {
          // build a fast lookup structure for rendering
          optionValuesForRender = {};
          for (
            var optionIndex = 0;
            optionIndex < optionValues.length;
            optionIndex++
          ) {
            var optionValue = optionValues[optionIndex];
            if (typeof optionValue.values == "object") {
              for (
                var groupOptionIndex = 0;
                groupOptionIndex < optionValue.values.length;
                groupOptionIndex++
              ) {
                var groupOptionValue = optionValue.values[groupOptionIndex];
                optionValuesForRender[groupOptionValue.value] =
                  groupOptionValue.label;
              }
            } else optionValuesForRender[optionValue.value] = optionValue.label;
          }
        }

        this.columns.push(
          new Column({
            name: columndata.name,
            label: columndata.label ? columndata.label : columndata.name,
            datatype: columndata.datatype ? columndata.datatype : "string",
            editable: columndata.editable ? true : false,
            bar:
              typeof columndata.bar == "undefined"
                ? true
                : columndata.bar || false,
            hidden:
              typeof columndata.hidden == "undefined"
                ? false
                : columndata.hidden ? true : false,
            optionValuesForRender: optionValuesForRender,
            optionValues: optionValues
          })
        );
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
    if (jsonData.data)
      for (var i = 0; i < jsonData.data.length; i++) {
        var row = jsonData.data[i];
        if (!row.values) continue;

        let cellValues;

        // row values can be given as an array (same order as columns) or as an object (associative array)
        if (Object.prototype.toString.call(row.values) !== "[object Array]")
          cellValues = row.values;
        else {
          cellValues = {};
          for (var j = 0; j < row.values.length && j < this.columns.length; j++)
            cellValues[this.columns[j].name] = row.values[j];
        }

        // for each row we keep the orginal index, the id and all other attributes that may have been set in the JSON
        var rowData = {
          visible: true,
          originalIndex: i,
          id: row.id !== undefined && row.id !== null ? row.id : defaultRowId++,
          columns: []
        };

        for (var attributeName in row)
          if (attributeName != "id" && attributeName != "values")
            rowData[attributeName] = row[attributeName];

        // get column values for this rows
        for (var c = 0; c < this.columns.length; c++) {
          var cellValue =
            this.columns[c].name in cellValues
              ? cellValues[this.columns[c].name]
              : "";
          rowData.columns.push(this.getTypedValue(c, cellValue));
        }

        // add row data in our model
        this.data.push(rowData);
      }

    return true;
  }

  /**
     * Process columns
     * @private
     */
  processColumns() {
    for (
      var columnIndex = 0;
      columnIndex < this.columns.length;
      columnIndex++
    ) {
      var column = this.columns[columnIndex];

      // set column index and back pointer
      column.columnIndex = columnIndex;
      column.editablegrid = this;

      // parse column type
      this.parseColumnType(column);

      // create suited enum provider if none given
      if (!column.enumProvider)
        column.enumProvider = column.optionValues ? new EnumProvider() : null;

      // create suited cell renderer if none given
      if (!column.cellRenderer) this._createCellRenderer(column);
      if (!column.headerRenderer) this._createHeaderRenderer(column);

      // create suited cell editor if none given
      if (!column.cellEditor) this._createCellEditor(column);
      if (!column.headerEditor) this._createHeaderEditor(column);

      // add default cell validators based on the column type
      this._addDefaultCellValidators(column);
    }
  }

  /**
     * Parse column type
     * @private
     */

  parseColumnType(column) {
    // reset
    column.unit = null;
    column.precision = -1;
    column.decimal_point = ".";
    column.thousands_separator = ",";
    column.unit_before_number = false;
    column.nansymbol = "";

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
      column.unit_before_number = column.unit_before_number.trim() == "1";
      column.nansymbol = column.nansymbol.trim();
    } else if (column.datatype.match(/(.*)\((.*),(.*),(.*),(.*),(.*)\)$/)) {
      // extract precision, unit and number format from type if 5 given
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
      column.unit_before_number = column.unit_before_number.trim() == "1";
    } else if (column.datatype.match(/(.*)\((.*),(.*),(.*)\)$/)) {
      // extract precision, unit and nansymbol from type if 3 given
      column.datatype = RegExp.$1;
      column.unit = RegExp.$2.trim();
      column.precision = parseInt(RegExp.$3);
      column.nansymbol = RegExp.$4.trim();
    } else if (column.datatype.match(/(.*)\((.*),(.*)\)$/)) {
      // extract precision and unit from type if two given
      column.datatype = RegExp.$1.trim();
      column.unit = RegExp.$2.trim();
      column.precision = parseInt(RegExp.$3);
    } else if (column.datatype.match(/(.*)\((.*)\)$/)) {
      // extract precision or unit from type if any given
      column.datatype = RegExp.$1.trim();
      var unit_or_precision = RegExp.$2.trim();
      if (unit_or_precision.match(/^[0-9]*$/))
        column.precision = parseInt(unit_or_precision);
      else column.unit = unit_or_precision;
    }

    if (column.decimal_point == "comma") column.decimal_point = ",";
    if (column.decimal_point == "dot") column.decimal_point = ".";
    if (column.thousands_separator == "comma") column.thousands_separator = ",";
    if (column.thousands_separator == "dot") column.thousands_separator = ".";

    if (isNaN(column.precision)) column.precision = -1;
    if (column.unit == "") column.unit = null;
    if (column.nansymbol == "") column.nansymbol = null;
  }

  /**
     * Get typed value
     * @private
     */

  getTypedValue(columnIndex, cellValue) {
    if (cellValue === null) return cellValue;

    var colType = this.getColumnType(columnIndex);
    if (colType == "boolean")
      cellValue =
        cellValue && cellValue != 0 && cellValue != "false" && cellValue != "f"
          ? true
          : false;
    if (colType == "integer") {
      cellValue = parseInt(cellValue, 10);
    }
    if (colType == "double") {
      cellValue = parseFloat(cellValue);
    }
    if (colType == "string") {
      cellValue = "" + cellValue;
    }

    return cellValue;
  }

  /**
     * Creates a suitable cell renderer for the column
     * @private
     */
  //TODO turn this into a proper factory
  _createCellRenderer(column) {
    column.cellRenderer = column.enumProvider
      ? new EnumCellRenderer()
      : column.datatype == "integer" || column.datatype == "double"
        ? new NumberCellRenderer()
        : column.datatype == "boolean"
          ? new CheckboxCellRenderer()
          : column.datatype == "email"
            ? new EmailCellRenderer()
            : column.datatype == "website" || column.datatype == "url"
              ? new WebsiteCellRenderer()
              : column.datatype == "date"
                ? new DateCellRenderer()
                : column.datatype == "hashtag"
                  ? new HashtagCellRenderer()
                  : column.datatype == "action"
                    ? new ActionCellRenderer()
                    : column.datatype == "array"
                      ? new ArrayCellRenderer()
                      : new CellRenderer();

    // give access to the column from the cell renderer
    if (column.cellRenderer) {
      column.cellRenderer.editablegrid = this;
      column.cellRenderer.column = column;
    }
  }

  /**
     * Creates a suitable header cell renderer for the column
     * @private
     */
  _createHeaderRenderer(column) {
    column.headerRenderer = new CellRenderer();

    // give access to the column from the header cell renderer
    if (column.headerRenderer) {
      column.headerRenderer.editablegrid = this;
      column.headerRenderer.column = column;
    }
  }

  /**
     * Creates a suitable cell editor for the column
     * @private
     */
  //TODO create a factory method inside the text editor
  _createCellEditor(column) {
    column.cellEditor = column.enumProvider
      ? new SelectCellEditor()
      : column.datatype == "integer" || column.datatype == "double"
        ? new NumberCellEditor(column.datatype)
        : column.datatype == "boolean"
          ? null
          : column.datatype == "email"
            ? new TextCellEditor(column.precision)
            : column.datatype == "array"
              ? new ArrayCellEditor()
              : column.datatype == "website" || column.datatype == "url"
                ? new TextCellEditor(column.precision)
                : column.datatype == "date"
                  ? typeof jQuery == "undefined" ||
                    typeof jQuery.datepicker == "undefined"
                    ? new TextCellEditor(column.precision, 10)
                    : new DateCellEditor({
                        fieldSize: column.precision,
                        maxLength: 10
                      })
                  : new TextCellEditor(column.precision);

    // give access to the column from the cell editor
    if (column.cellEditor) {
      column.cellEditor.editablegrid = this;
      column.cellEditor.column = column;
    }
  }

  /**
     * Creates a suitable header cell editor for the column
     * @private
     */
  _createHeaderEditor(column) {
    column.headerEditor = new TextCellEditor();

    // give access to the column from the cell editor
    if (column.headerEditor) {
      column.headerEditor.editablegrid = this;
      column.headerEditor.column = column;
    }
  }

  /**
     * Returns the number of rows
     */
  getRowCount() {
    return this.data.length;
  }

  /**
     * Returns the number of rows, not taking the filter into account if any
     */
  getUnfilteredRowCount() {
    // given if server-side filtering is involved
    if (this.unfilteredRowCount > 0) return this.unfilteredRowCount;

    var _data = this.dataUnfiltered == null ? this.data : this.dataUnfiltered;
    return _data.length;
  }

  getTotalRowCount() {
    // different from getRowCount only is server-side pagination is involved
    if (this.totalRowCount > 0) return this.totalRowCount;

    return this.getRowCount();
  }

  getColumnCount() {
    return this.columns.length;
  }

  hasColumn(columnIndexOrName) {
    return this.getColumnIndex(columnIndexOrName) >= 0;
  }

  getColumn(columnIndexOrName) {
    var colIndex = this.getColumnIndex(columnIndexOrName);
    if (colIndex < 0) {
      console.error(
        "[getColumn] Column not found with index or name " + columnIndexOrName
      );
      return null;
    }
    return this.columns[colIndex];
  }

  getColumnName(columnIndexOrName) {
    return this.getColumn(columnIndexOrName).name;
  }

  getColumnLabel(columnIndexOrName) {
    return this.getColumn(columnIndexOrName).label;
  }

  getColumnType(columnIndexOrName) {
    return this.getColumn(columnIndexOrName).datatype;
  }

  getColumnUnit(columnIndexOrName) {
    return this.getColumn(columnIndexOrName).unit;
  }

  getColumnPrecision(columnIndexOrName) {
    return this.getColumn(columnIndexOrName).precision;
  }

  isColumnBar(columnIndexOrName) {
    var column = this.getColumn(columnIndexOrName);
    return column.bar && column.isNumerical();
  }

  getColumnStack(columnIndexOrName) {
    var column = this.getColumn(columnIndexOrName);
    return column.isNumerical() ? column.bar : "";
  }

  isColumnNumerical(columnIndexOrName) {
    var column = this.getColumn(columnIndexOrName);
    return column.isNumerical();
  }

  getValueAt(rowIndex, columnIndex) {
    // check and get column
    if (columnIndex < 0 || columnIndex >= this.columns.length) {
      console.error("[getValueAt] Invalid column index " + columnIndex);
      return null;
    }
    var column = this.columns[columnIndex];

    // get value in model
    if (rowIndex < 0) return column.label;

    if (typeof this.data[rowIndex] == "undefined") {
      console.error("[getValueAt] Invalid row index " + rowIndex);
      return null;
    }
    var rowData = this.data[rowIndex]["columns"];
    return rowData ? rowData[columnIndex] : null;
  }

  getDisplayValueAt(rowIndex, columnIndex) {
    // use renderer to get the value that must be used for sorting and filtering
    var value = this.getValueAt(rowIndex, columnIndex);
    var renderer =
      rowIndex < 0
        ? this.columns[columnIndex].headerRenderer
        : this.columns[columnIndex].cellRenderer;
    return renderer.getDisplayValue(rowIndex, value);
  }

  setValueAt(rowIndex, columnIndex, value, render = true) {
    var previousValue = null;

    // check and get column
    if (columnIndex < 0 || columnIndex >= this.columns.length) {
      console.error("[setValueAt] Invalid column index " + columnIndex);
      return null;
    }
    var column = this.columns[columnIndex];

    // set new value in model
    if (rowIndex < 0) {
      previousValue = column.label;
      column.label = value;
    } else {
      if (typeof this.data[rowIndex] == "undefined") {
        console.error("Invalid rowindex " + rowIndex);
        return null;
      }

      var rowData = this.data[rowIndex]["columns"];
      previousValue = rowData[columnIndex];
      if (rowData)
        rowData[columnIndex] = this.getTypedValue(columnIndex, value);
    }

    // render new value
    if (render) {
      var renderer = rowIndex < 0 ? column.headerRenderer : column.cellRenderer;
      var cell = this.getCell(rowIndex, columnIndex);
      if (cell) renderer._render(rowIndex, columnIndex, cell, value);
    }

    return previousValue;
  }

  getColumnIndex(columnIndexOrName) {
    if (typeof columnIndexOrName == "undefined" || columnIndexOrName === "")
      return -1;

    // TODO: problem because the name of a column could be a valid index, and we cannot make the distinction here!

    // if columnIndexOrName is a number which is a valid index return it
    if (
      !isNaN(columnIndexOrName) &&
      columnIndexOrName >= 0 &&
      columnIndexOrName < this.columns.length
    )
      return columnIndexOrName;

    // otherwise search for the name
    for (var c = 0; c < this.columns.length; c++)
      if (this.columns[c].name == columnIndexOrName) return c;

    return -1;
  }

  getRow(rowIndex) {
    if (rowIndex < 0) return this.tHead.rows[rowIndex + this.nbHeaderRows];
    if (typeof this.data[rowIndex] == "undefined") {
      console.error("[getRow] Invalid row index " + rowIndex);
      return null;
    }
    return _$(this._getRowDOMId(this.data[rowIndex].id));
  }

  getRowId(rowIndex) {
    return rowIndex < 0 || rowIndex >= this.data.length
      ? null
      : this.data[rowIndex]["id"];
  }

  getRowIndex(rowId) {
    rowId = typeof rowId == "object" ? rowId.rowId : rowId;
    for (var rowIndex = 0; rowIndex < this.data.length; rowIndex++)
      if (this.data[rowIndex].id == rowId) return rowIndex;
    return -1;
  }

  getRowAttribute(rowIndex, attributeName) {
    if (typeof this.data[rowIndex] == "undefined") {
      console.error("Invalid rowindex " + rowIndex);
      return null;
    }

    return this.data[rowIndex][attributeName];
  }

  setRowAttribute(rowIndex, attributeName, attributeValue) {
    this.data[rowIndex][attributeName] = attributeValue;
  }

  _getRowDOMId(rowId) {
    return this.currentContainerid != null ? this.name + "_" + rowId : rowId;
  }

  removeRow(rowId) {
    return this.remove(this.getRowIndex(rowId));
  }

  remove(rowIndex) {
    var rowId = this.data[rowIndex].id;
    var originalIndex = this.data[rowIndex].originalIndex;
    var _data = this.dataUnfiltered == null ? this.data : this.dataUnfiltered;

    // delete row from DOM (needed for attach mode)
    var tr = _$(this._getRowDOMId(rowId));
    if (tr != null) this.tBody.removeChild(tr);

    // update originalRowIndex
    for (var r = 0; r < _data.length; r++)
      if (_data[r].originalIndex >= originalIndex) _data[r].originalIndex--;

    // delete row from data
    this.data.splice(rowIndex, 1);
    if (this.dataUnfiltered != null)
      for (var r = 0; r < this.dataUnfiltered.length; r++)
        if (this.dataUnfiltered[r].id == rowId) {
          this.dataUnfiltered.splice(r, 1);
          break;
        }

    // callback
    this.rowRemoved(rowIndex, rowId);

    // refresh grid
    this.refreshGrid();
  }

  getRowValues(rowIndex) {
    var rowValues = {};
    for (
      var columnIndex = 0;
      columnIndex < this.getColumnCount();
      columnIndex++
    ) {
      rowValues[this.getColumnName(columnIndex)] = this.getValueAt(
        rowIndex,
        columnIndex
      );
    }
    return rowValues;
  }

  setHeaderRenderer(columnIndexOrName, cellRenderer) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0)
      console.error("[setHeaderRenderer] Invalid column: " + columnIndexOrName);
    else {
      var column = this.columns[columnIndex];
      column.headerRenderer = cellRenderer;

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
  }

  setCellRenderer(columnIndexOrName, cellRenderer) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0)
      console.error("[setCellRenderer] Invalid column: " + columnIndexOrName);
    else {
      var column = this.columns[columnIndex];
      column.cellRenderer = cellRenderer;

      // give access to the column from the cell renderer
      if (cellRenderer) {
        cellRenderer.editablegrid = this;
        cellRenderer.column = column;
      }
    }
  }

  setCellEditor(columnIndexOrName, cellEditor) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0)
      console.error("[setCellEditor] Invalid column: " + columnIndexOrName);
    else {
      var column = this.columns[columnIndex];
      column.cellEditor = cellEditor;

      // give access to the column from the cell editor
      if (cellEditor) {
        cellEditor.editablegrid = this;
        cellEditor.column = column;
      }
    }
  }

  setHeaderEditor(columnIndexOrName, cellEditor) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0)
      console.error("[setHeaderEditor] Invalid column: " + columnIndexOrName);
    else {
      var column = this.columns[columnIndex];
      column.headerEditor = cellEditor;

      // give access to the column from the cell editor
      if (cellEditor) {
        cellEditor.editablegrid = this;
        cellEditor.column = column;
      }
    }
  }

  setEnumProvider(columnIndexOrName, enumProvider) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0)
      console.error("[setEnumProvider] Invalid column: " + columnIndexOrName);
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
  }

  clearCellValidators(columnIndexOrName) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0)
      console.error(
        "[clearCellValidators] Invalid column: " + columnIndexOrName
      );
    else this.columns[columnIndex].cellValidators = [];
  }

  addDefaultCellValidators(columnIndexOrName) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0)
      console.error(
        "[addDefaultCellValidators] Invalid column: " + columnIndexOrName
      );
    return this._addDefaultCellValidators(this.columns[columnIndex]);
  }

  _addDefaultCellValidators(column) {
    if (column.datatype == "integer" || column.datatype == "double")
      column.cellValidators.push(new NumberCellValidator(column.datatype));
    else if (column.datatype == "email")
      column.cellValidators.push(new EmailCellValidator());
    else if (column.datatype == "website" || column.datatype == "url")
      column.cellValidators.push(new WebsiteCellValidator());
    else if (column.datatype == "date")
      column.cellValidators.push(new DateCellValidator(this));
  }

  addCellValidator(columnIndexOrName, cellValidator) {
    var columnIndex = this.getColumnIndex(columnIndexOrName);
    if (columnIndex < 0)
      console.error("[addCellValidator] Invalid column: " + columnIndexOrName);
    else this.columns[columnIndex].cellValidators.push(cellValidator);
  }

  setCaption(caption) {
    this.caption = caption;
  }

  getCell(rowIndex, columnIndex) {
    var row = this.getRow(rowIndex);
    console.log(row);
    if (row == null) {
      console.error("[getCell] Invalid row index " + rowIndex);
      return null;
    }
    return row.cells[columnIndex];
  }

  getCellX(oElement) {
    var iReturnValue = 0;
    while (oElement != null && EditableGrid.isStatic(oElement))
      try {
        iReturnValue += oElement.offsetLeft;
        oElement = oElement.offsetParent;
      } catch (err) {
        oElement = null;
      }
    return iReturnValue;
  }

  getCellY(oElement) {
    var iReturnValue = 0;
    while (oElement != null && EditableGrid.isStatic(oElement))
      try {
        iReturnValue += oElement.offsetTop;
        oElement = oElement.offsetParent;
      } catch (err) {
        oElement = null;
      }
    return iReturnValue;
  }

  getScrollXOffset(oElement) {
    var iReturnValue = 0;
    while (
      oElement != null &&
      typeof oElement.scrollLeft != "undefined" &&
      EditableGrid.isStatic(oElement) &&
      oElement != document.body
    )
      try {
        iReturnValue += parseInt(oElement.scrollLeft);
        oElement = oElement.parentNode;
      } catch (err) {
        oElement = null;
      }
    return iReturnValue;
  }

  getScrollYOffset(oElement) {
    var iReturnValue = 0;
    while (
      oElement != null &&
      typeof oElement.scrollTop != "undefined" &&
      EditableGrid.isStatic(oElement) &&
      oElement != document.body
    )
      try {
        iReturnValue += parseInt(oElement.scrollTop);
        oElement = oElement.parentNode;
      } catch (err) {
        oElement = null;
      }
    return iReturnValue;
  }

  _rendergrid(containerid, className) {
    this.lastSelectedRowIndex = -1;

    if (!containerid)
      return console.error(
        "Container ID not specified (renderGrid not called yet ?)"
      );
    if (!_$(containerid))
      return console.error("Unable to get element [" + containerid + "]");

    this.currentContainerid = containerid;
    this.currentClassName = className;

    var startRowIndex = 0;
    var endRowIndex = this.getRowCount();

    // create editablegrid table and add it to our container
    this.table = document.createElement("table");
    this.table.className = className || "editablegrid";

    //while (_$(containerid).hasChildNodes()) _$(containerid).removeChild(_$(containerid).firstChild);
    $("#" + containerid).empty();

    _$(containerid).appendChild(this.table);

    console.log(this.table);

    // create header
    if (this.caption) {
      var captionElement = document.createElement("CAPTION");
      captionElement.innerHTML = this.caption;
      this.table.appendChild(captionElement);
    }

    this.tHead = document.createElement("THEAD");
    this.table.appendChild(this.tHead);
    var trHeader = this.tHead.insertRow(0);
    var columnCount = this.getColumnCount();
    for (var c = 0; c < columnCount; c++) {
      var headerCell = document.createElement("TH");
      var td = trHeader.appendChild(headerCell);
      this.columns[c].headerRenderer._render(-1, c, td, this.columns[c].label);
    }

    // create body and rows
    this.tBody = document.createElement("TBODY");
    this.table.appendChild(this.tBody);
    var insertRowIndex = 0;
    for (var i = startRowIndex; i < endRowIndex; i++) {
      var tr = this.tBody.insertRow(insertRowIndex++);
      tr.rowId = this.data[i]["id"];
      tr.id = this._getRowDOMId(this.data[i]["id"]);

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

      for (var j = 0; j < columnCount; j++) {
        // create cell and render its content
        var td = tr.insertCell(j);

        if (j == this.getColumnIndex("description")) {
          //get the indent level
          var dataToSend = this.jsData.settings.showComments
            ? {
                desc: this.getValueAt(i, j),
                comment: item.values.comments
              }
            : this.getValueAt(i, j);
          this.columns[j].cellRenderer._render(i, j, td, dataToSend);

          var indentLevel = item.values.indent;
          td.style = "padding-left: " + 20 * indentLevel + "px";
        } else {
          this.columns[j].cellRenderer._render(i, j, td, this.getValueAt(i, j));
        }
      }
    }

    // attach handler on click or double click
    _$(containerid)["editablegrid"] = this;
    _$(containerid).onclick = e => {
      this.mouseClicked(e);
    };

    // callback
    this.tableRendered(containerid, className);
  }

  renderGrid(containerid, className) {
    // actually render grid
    this._rendergrid(containerid, className);
  }

  refreshGrid() {
    if (this.currentContainerid != null) this.table = null; // if we are not in "attach mode", clear table to force a full re-render
    this._rendergrid(this.currentContainerid, this.currentClassName);
  }

  _renderHeaders() {
    var rows = this.tHead.rows;
    for (var i = 0; i < 1 /*rows.length*/; i++) {
      var rowData = [];
      var cols = rows[i].cells;
      var columnIndexInModel = 0;
      for (
        var j = 0;
        j < cols.length && columnIndexInModel < this.columns.length;
        j++
      ) {
        this.columns[columnIndexInModel].headerRenderer._render(
          -1,
          columnIndexInModel,
          cols[j],
          this.columns[columnIndexInModel].label
        );
        var colspan = parseInt(cols[j].getAttribute("colspan"));
        columnIndexInModel += colspan > 1 ? colspan : 1;
      }
    }
  }

  mouseClicked(e) {
    console.log("mouse click edit");
    e = e || window.event;

    // get row and column index from the clicked cell
    var target = e.target || e.srcElement;

    // go up parents to find a cell or a link under the clicked position
    while (target)
      if (
        target.tagName == "A" ||
        target.tagName == "TD" ||
        target.tagName == "TH"
      )
        break;
      else target = target.parentNode;
    if (
      !target ||
      !target.parentNode ||
      !target.parentNode.parentNode ||
      (target.parentNode.parentNode.tagName != "TBODY" &&
        target.parentNode.parentNode.tagName != "THEAD") ||
      target.isEditing
    )
      return;

    // don't handle clicks on links
    if (target.tagName == "A") return;

    // get cell position in table
    var rowIndex = this.getRowIndex(target.parentNode);
    var columnIndex = target.cellIndex;

    this.editCell(rowIndex, columnIndex);
  }

  editCell(rowIndex, columnIndex) {
    console.log(rowIndex, columnIndex);
    var target = this.getCell(rowIndex, columnIndex);

    var column = this.columns[columnIndex];
    if (column) {
      // if another row has been selected: callback
      if (rowIndex > -1) {
        this.rowSelected(this.lastSelectedRowIndex, rowIndex);
        this.lastSelectedRowIndex = rowIndex;
      }

      // edit current cell value
      if (!column.editable) {
        this.readonlyWarning();
      } else {
        if (rowIndex < 0) {
          if (
            column.headerEditor &&
            this.isHeaderEditable(rowIndex, columnIndex)
          )
            column.headerEditor.edit(
              rowIndex,
              columnIndex,
              target,
              column.label
            );
        } else if (column.cellEditor && this.isEditable(rowIndex, columnIndex))
          column.cellEditor.edit(
            rowIndex,
            columnIndex,
            target,
            this.getValueAt(rowIndex, columnIndex)
          );
      }
    }
  }

  static _convertOptions(optionValues) {
    // option values should be an *ordered* array of value/label pairs, but to stay compatible with existing enum providers
    if (
      optionValues !== null &&
      !(optionValues instanceof Array) &&
      typeof optionValues == "object"
    ) {
      var _converted = [];
      for (var value in optionValues) {
        if (typeof optionValues[value] == "object")
          _converted.push({
            label: value,
            values: this._convertOptions(optionValues[value])
          }); // group
        else _converted.push({ value: value, label: optionValues[value] });
      }
      optionValues = _converted;
    }

    return optionValues;
  }

  static getStyle(element, stylePropCamelStyle, stylePropCSSStyle = "") {
    stylePropCSSStyle = stylePropCSSStyle || stylePropCamelStyle;
    if (element.currentStyle) return element.currentStyle[stylePropCamelStyle];
    else if (window.getComputedStyle)
      return document.defaultView
        .getComputedStyle(element, null)
        .getPropertyValue(stylePropCSSStyle);
    return element.style[stylePropCamelStyle];
  }

  static isStatic(element) {
    var position = this.getStyle(element, "position");
    return !position || position == "static";
  }

  static verticalAlign(element) {
    return this.getStyle(element, "verticalAlign", "vertical-align");
  }

  static paddingLeft(element) {
    var padding = parseInt(
      this.getStyle(element, "paddingLeft", "padding-left")
    );
    return isNaN(padding) ? 0 : Math.max(0, padding);
  }

  static paddingRight(element) {
    var padding = parseInt(
      this.getStyle(element, "paddingRight", "padding-right")
    );
    return isNaN(padding) ? 0 : Math.max(0, padding);
  }

  static paddingTop(element) {
    var padding = parseInt(this.getStyle(element, "paddingTop", "padding-top"));
    return isNaN(padding) ? 0 : Math.max(0, padding);
  }

  static paddingBottom(element) {
    var padding = parseInt(
      this.getStyle(element, "paddingBottom", "padding-bottom")
    );
    return isNaN(padding) ? 0 : Math.max(0, padding);
  }

  static borderLeft(element) {
    var border_l = parseInt(
      this.getStyle(element, "borderRightWidth", "border-right-width")
    );
    var border_r = parseInt(
      this.getStyle(element, "borderLeftWidth", "border-left-width")
    );
    border_l = isNaN(border_l) ? 0 : border_l;
    border_r = isNaN(border_r) ? 0 : border_r;
    return Math.max(border_l, border_r);
  }

  static borderRight(element) {
    return this.borderLeft(element);
  }

  static borderTop(element) {
    var border_t = parseInt(
      this.getStyle(element, "borderTopWidth", "border-top-width")
    );
    var border_b = parseInt(
      this.getStyle(element, "borderBottomWidth", "border-bottom-width")
    );
    border_t = isNaN(border_t) ? 0 : border_t;
    border_b = isNaN(border_b) ? 0 : border_b;
    return Math.max(border_t, border_b);
  }

  static borderBottom(element) {
    return this.borderTop(element);
  }

  static autoWidth(element) {
    return (
      element.offsetWidth -
      this.paddingLeft(element) -
      this.paddingRight(element) -
      this.borderLeft(element) -
      this.borderRight(element)
    );
  }

  static autoHeight(element) {
    return (
      element.offsetHeight -
      this.paddingTop(element) -
      this.paddingBottom(element) -
      this.borderTop(element) -
      this.borderBottom(element)
    );
  }

  static isSame(v1, v2) {
    if (v1 === v2) return true;
    if (
      typeof v1 == "number" &&
      isNaN(v1) &&
      typeof v2 == "number" &&
      isNaN(v2)
    )
      return true;
    if (v1 === "" && v2 === null) return true;
    if (v2 === "" && v1 === null) return true;
    return false;
  }

  static strip(str) {
    return str.replace(/^\s+/, "").replace(/\s+$/, "");
  }
  static hasClassName(element, className) {
    return (
      element.className.length > 0 &&
      (element.className == className ||
        new RegExp(
          "(^|\\s)" +
            className.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&") +
            "(\\s|$)"
        ).test(element.className))
    );
  }
  static addClassName(element, className) {
    if (!this.hasClassName(element, className))
      element.className += (element.className ? " " : "") + className;
  }
  static removeClassName(element, className) {
    element.className = this.strip(
      element.className.replace(
        new RegExp("(^|\\s+)" + className + "(\\s+|$)"),
        " "
      )
    );
  }
}
