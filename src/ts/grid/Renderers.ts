import { EditableGrid, _$ } from "./EditableGrid";
import * as moment from "moment";
import { CellEditor } from "./Editors";

export class CellRenderer {
  column: any;
  editablegrid: EditableGrid;

  constructor(config = {}) {
    this.init(config);
  }

  init(config) {
    // override default properties with the ones given
    for (var p in config) this[p] = config[p];
  }

  _render(rowIndex, columnIndex, element, value) {
    // remember all the things we need
    element.rowIndex = rowIndex;
    element.columnIndex = columnIndex;

    // remove existing content
    while (element.hasChildNodes()) element.removeChild(element.firstChild);

    // clear isEditing (in case a currently editeed is being re-rendered by some external call)
    element.isEditing = false;

    // always apply the number class to numerical cells and column headers
    if (this.column.isNumerical()) EditableGrid.addClassName(element, "number");

    // always apply the boolean class to boolean column headers
    if (this.column.datatype == "boolean")
      EditableGrid.addClassName(element, "boolean");

    // apply a css class corresponding to the column name
    EditableGrid.addClassName(element, "editablegrid-" + this.column.name);

    // add a data-title attribute used for responsiveness
    element.setAttribute("data-title", this.column.label);

    // call the specialized render method
    return this.render(element, value);
  }

  render(element, value, escapehtml = false) {
    var _value = value;
    element.innerHTML = _value ? _value : "";
  }

  getDisplayValue(rowIndex, value) {
    return value;
  }
}

export class EnumCellRenderer extends CellRenderer {
  constructor(config = {}) {
    super();
    this.init(config);
  }

  getLabel(rowIndex, value) {
    var label = null;
    if (typeof value != "undefined") {
      value = value ? value : "";
      var optionValues = this.column.getOptionValuesForRender(rowIndex);
      if (optionValues && value in optionValues) label = optionValues[value];
      if (label === null) {
        var isNAN = typeof value == "number" && isNaN(value);
        label = isNAN ? "" : value;
      }
    }
    return label ? label : "";
  }

  render(element, value) {
    var label = this.getLabel(element.rowIndex, value);
    element.innerHTML = label ? label : "";
  }

  getDisplayValue(rowIndex, value) {
    // if the column has enumerated values, sort and filter on the value label
    return value === null ? null : this.getLabel(rowIndex, value);
  }
}

export class NumberCellRenderer extends CellRenderer {
  constructor(config = {}) {
    super();
    this.init(config);
  }

  render(element, value) {
    var column = this.column || {}; // in case somebody calls new NumberCellRenderer().render(..)

    var isNAN = value === null || (typeof value == "number" && isNaN(value));
    var displayValue = isNAN ? column.nansymbol || "" : value;
    if (typeof displayValue == "number") {
      if (column.unit !== null) {
        if (column.unit_before_number)
          displayValue = column.unit + " " + displayValue;
        else displayValue = displayValue + " " + column.unit;
      }
    }

    element.innerHTML = displayValue;
    if (isNAN) EditableGrid.addClassName(element, "nan");
    else EditableGrid.removeClassName(element, "nan");
  }
}

export class CheckboxCellRenderer extends CellRenderer {
  constructor(config = {}) {
    super();
    this.init(config);
  }

  _render(rowIndex, columnIndex, element, value) {
    // if a checkbox already exists keep it, otherwise clear current content
    if (
      element.firstChild &&
      (typeof element.firstChild.getAttribute != "function" ||
        element.firstChild.getAttribute("type") != "checkbox")
    )
      while (element.hasChildNodes()) element.removeChild(element.firstChild);

    // remember all the things we need
    element.rowIndex = rowIndex;
    element.columnIndex = columnIndex;

    // apply a css class corresponding to the column name
    EditableGrid.addClassName(element, "editablegrid-" + this.column.name);

    // add a data-title attribute used for responsiveness
    element.setAttribute("data-title", this.column.label);

    // call the specialized render method
    return this.render(element, value);
  }

  render(element, value) {
    // convert value to boolean just in case
    value = value && value != 0 && value != "false" ? true : false;

    // if check box already created, just update its state
    if (element.firstChild) {
      element.firstChild.checked = value;
      return;
    }

    // create and initialize checkbox
    var htmlInput = document.createElement("input");
    htmlInput.setAttribute("type", "checkbox");

    // give access to the cell editor and element from the editor field
    _$(htmlInput)["element"] = element;

    // this renderer is a little special because it allows direct edition
    var cellEditor = new CellEditor();
    cellEditor.editablegrid = this.editablegrid;
    cellEditor.column = this.column;
    htmlInput.onclick = event => {
      element.rowIndex = this.editablegrid.getRowIndex(element.parentNode); // in case it has changed due to sorting or remove
      element.isEditing = true;
      cellEditor.applyEditing(element, htmlInput.checked ? true : false);
    };

    element.appendChild(htmlInput);
    htmlInput.checked = value;
    htmlInput.disabled =
      !this.column.editable ||
      !this.editablegrid.isEditable(element.rowIndex, element.columnIndex);

    EditableGrid.addClassName(element, "boolean");
  }
}

export class EmailCellRenderer extends CellRenderer {
  constructor(config = {}) {
    super();
    this.init(config);
  }

  render(element, value) {
    element.innerHTML = value
      ? "<a href='mailto:" + value + "'>" + value + "</a>"
      : "";
  }
}

export class ArrayCellRenderer extends CellRenderer {
  constructor(config = {}) {
    super();
    this.init(config);
  }

  render(element, value) {
    //join the array into a CSV
    element.innerHTML = value.join(",");
  }
}

export class HashtagCellRenderer extends CellRenderer {
  constructor(config = {}) {
    super();
    this.init(config);
  }

  render(element, dataobj) {
    //TODO clean up this code to not be so haphazard
    var value = typeof dataobj === "string" ? dataobj : dataobj.desc;
    var comment = typeof dataobj === "string" ? null : dataobj.comment;
    //take the value and add SPAN
    //split on space
    //if starts with #, wrap with SPAN
    //put those pieces back together
    var _ = require("lodash");
    var output = [];
    _.each(value.split(" "), function(item) {
      switch (item[0]) {
        case "#":
          item =
            '<span data-type=tags class="label label-primary label-search">' +
            item.substring(1) +
            "</span>";
          break;
        case "@":
          item =
            '<span data-type=status class="label label-info label-search">' +
            item.substring(1) +
            "</span>";
          break;
        case "!":
          item =
            '<span data-type=milestone class="label label-warning label-search">' +
            item.substring(1) +
            "</span>";
          break;
      }
      output.push(item);
    });

    var innerHTML = output.join(" ");

    //this will add the comment to the rendering
    //TODO add some classes and style this better
    if (comment != null) {
      innerHTML += "<p><i>" + comment + "</i></p>";
    }
    element.innerHTML = innerHTML;
  }
}

export class ActionCellRenderer extends CellRenderer {
  constructor(config = {}) {
    super();
    this.init(config);
  }

  render(element, value) {
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
			</div>`;
    element.innerHTML = innerHTML;
  }
}

export class WebsiteCellRenderer extends CellRenderer {
  constructor(config = {}) {
    super();
    this.init(config);
  }

  render(element, value) {
    element.innerHTML = value
      ? "<a href='" +
        (value.indexOf("//") == -1 ? "http://" + value : value) +
        "'>" +
        value +
        "</a>"
      : "";
  }
}

export class DateCellRenderer extends CellRenderer {
  constructor(config = {}) {
    super();
    this.init(config);
  }

  render(cell, value) {
    let d = moment(value);

    if (d.isValid()) {
      cell.innerHTML = d.format("mm/dd/yyy");
    } else {
      cell.innerHTML = value ? value : "";
    }
    cell.style.whiteSpace = "nowrap";
  }
}
