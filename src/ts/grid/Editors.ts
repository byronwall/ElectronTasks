import { EditableGrid } from "./EditableGrid";

export class CellEditor {
  column: any;
  editablegrid: EditableGrid;
  constructor(config = {}) {
    this.init(config);
  }

  init(config) {
    // override default properties with the ones given
    if (config) for (var p in config) this[p] = config[p];
  }

  edit(rowIndex, columnIndex, element, value) {
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
    editorInput.onkeydown = function(event) {
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
        if (
          this.celleditor.applyEditing(
            this.element,
            this.celleditor.getEditorValue(this)
          ) === false
        )
          this.onblur = this.onblur_backup;

        // TAB: move to next cell
        if (event.keyCode == 9) {
          if (
            this.element.rowIndex >= 0 &&
            this.celleditor.editablegrid.getColumnCount() > 0 &&
            this.celleditor.editablegrid.getRowCount() > 0
          ) {
            var candidateRowIndex = this.element.rowIndex;
            var candidateColumnIndex = this.element.columnIndex;

            while (true) {
              //TODO find a way to simplify this code instead of duplicating
              // find next cell in grid, go backward if holding SHIFT
              if (event.shiftKey) {
                if (candidateColumnIndex > 0) candidateColumnIndex--;
                else {
                  candidateRowIndex--;
                  candidateColumnIndex =
                    this.celleditor.editablegrid.getColumnCount() - 1;
                }
                if (candidateRowIndex < 0)
                  candidateRowIndex =
                    this.celleditor.editablegrid.getRowCount() - 1;
              } else {
                if (
                  candidateColumnIndex <
                  this.celleditor.editablegrid.getColumnCount() - 1
                )
                  candidateColumnIndex++;
                else {
                  candidateRowIndex++;
                  candidateColumnIndex = 0;
                }
                if (
                  candidateRowIndex >=
                  this.celleditor.editablegrid.getRowCount()
                )
                  candidateRowIndex = 0;
              }

              // candidate cell is editable: edit it and break
              var column = this.celleditor.editablegrid.getColumn(
                candidateColumnIndex
              );
              if (
                column.editable &&
                column.datatype != "boolean" &&
                this.celleditor.editablegrid.isEditable(
                  candidateRowIndex,
                  candidateColumnIndex
                )
              ) {
                this.celleditor.editablegrid.editCell(
                  candidateRowIndex,
                  candidateColumnIndex
                );
                break;
              }

              // if we ever come back to the original cell, break
              if (
                candidateRowIndex == this.element.rowIndex &&
                candidateColumnIndex == this.element.columnIndex
              )
                break;
            }
          }
        }

        return false;
      }

      // ESC: cancel editing
      if (event.keyCode == 27) {
        this.onblur = null;
        this.celleditor.cancelEditing(this.element);
        self.editablegrid.editorCancelled(rowIndex, columnIndex, this);
        return false;
      }
    };

    // if simultaneous edition is not allowed, we cancel edition when focus is lost

    if (!this.editablegrid.allowSimultaneousEdition)
      editorInput.onblur = this.editablegrid.saveOnBlur
        ? function(event) {
            // backup onblur then remove it: it will be restored if editing could not be applied
            this.onblur_backup = this.onblur;
            this.onblur = null;
            if (
              this.celleditor.applyEditing(
                this.element,
                this.celleditor.getEditorValue(this)
              ) === false
            ) {
              this.onblur = this.onblur_backup;
            } else {
              //call the callback so a listener can handle it
              self.editablegrid.editorBlurred(rowIndex, columnIndex, this);
            }
          }
        : function(event) {
            this.onblur = null;
            this.celleditor.cancelEditing(this.element);
          };

    // display the resulting editor widget
    this.displayEditor(element, editorInput);

    // give focus to the created editor
    this.autoFocus(editorInput);

    //auto focus the input if supported (for new tasks)
    this.scrollIntoView(editorInput);
  }

  scrollIntoView(editorInput) {
    //TODO clean these calls up (maybe just formatting?)
    if (jQuery(editorInput).position()) {
      if (jQuery(editorInput).position().top < jQuery(window).scrollTop()) {
        //scroll up
        jQuery("html,body").animate(
          { scrollTop: jQuery(editorInput).position().top },
          100
        );
      } else if (
        jQuery(editorInput).position().top + jQuery(editorInput).height() >
        jQuery(window).scrollTop() +
          (window.innerHeight || document.documentElement.clientHeight)
      ) {
        //scroll down
        jQuery("html,body").animate(
          {
            scrollTop:
              jQuery(editorInput).position().top -
              (window.innerHeight || document.documentElement.clientHeight) +
              jQuery(editorInput).height() +
              15
          },
          100
        );
      }
    }
  }

  autoFocus(editorInput) {
    editorInput.focus();
  }

  getEditor(element, value) {
    return null;
  }

  getEditorValue(editorInput) {
    return editorInput.value;
  }

  formatValue(value) {
    return value;
  }

  displayEditor(element, editorInput, adjustX = 0, adjustY = 0) {
    // use same font in input as in cell content
    editorInput.style.fontFamily = EditableGrid.getStyle(
      element,
      "fontFamily",
      "font-family"
    );
    editorInput.style.fontSize = EditableGrid.getStyle(
      element,
      "fontSize",
      "font-size"
    );

    // absolute mode: add input field in absolute position over table cell, leaving current content
    if (this.editablegrid.editmode == "absolute") {
      element.appendChild(editorInput);
      editorInput.style.position = "absolute";

      // position editor input on the cell with the same padding as the actual cell content (and center vertically if vertical-align is set to "middle")
      var paddingLeft = EditableGrid.paddingLeft(element);
      var paddingTop = EditableGrid.paddingTop(element);

      // find scroll offset
      var offsetScrollX = this.editablegrid.getScrollXOffset(element);
      var offsetScrollY = this.editablegrid.getScrollYOffset(element);

      // position input
      var vCenter =
        EditableGrid.verticalAlign(element) == "middle"
          ? (element.offsetHeight - editorInput.offsetHeight) / 2 - paddingTop
          : 0;
      editorInput.style.left =
        this.editablegrid.getCellX(element) -
        offsetScrollX +
        paddingLeft +
        (adjustX ? adjustX : 0) +
        "px";
      editorInput.style.top =
        this.editablegrid.getCellY(element) -
        offsetScrollY +
        paddingTop +
        vCenter +
        (adjustY ? adjustY : 0) +
        "px";

      // if number type: align field and its content to the right
      if (
        this.column.datatype == "integer" ||
        this.column.datatype == "double"
      ) {
        var rightPadding =
          this.editablegrid.getCellX(element) -
          offsetScrollX +
          element.offsetWidth -
          (parseInt(editorInput.style.left) + editorInput.offsetWidth);
        editorInput.style.left =
          parseInt(editorInput.style.left) + rightPadding + "px";
        editorInput.style.textAlign = "right";
      }
    }

    if (element && element.isEditing && this.editablegrid.openedCellEditor) {
      this.editablegrid.openedCellEditor(element.rowIndex, element.columnIndex);
    }
  }

  _clearEditor(element) {
    // untag element
    element.isEditing = false;
  }

  cancelEditing(element) {
    // check that the element is still being edited (otherwise onblur will be called on textfields that have been closed when we go to another tab in Firefox)
    if (element && element.isEditing) {
      // render value before editon
      var renderer =
        this == this.column.headerEditor
          ? this.column.headerRenderer
          : this.column.cellRenderer;
      renderer._render(
        element.rowIndex,
        element.columnIndex,
        element,
        this.editablegrid.getValueAt(element.rowIndex, element.columnIndex)
      );

      this._clearEditor(element);
    }
  }

  applyEditing(element, newValue) {
    // check that the element is still being edited (otherwise onblur will be called on textfields that have been closed when we go to another tab in Firefox)
    if (element && element.isEditing) {
      // do nothing if the value is rejected by at least one validator
      if (!this.column.isValid(newValue)) return false;

      // format the value before applying
      var formattedValue = this.formatValue(newValue);

      // update model and render cell (keeping previous value)
      var previousValue = this.editablegrid.setValueAt(
        element.rowIndex,
        element.columnIndex,
        formattedValue
      );

      // if the new value is different than the previous one, let the user handle the model change
      var newValue = this.editablegrid.getValueAt(
        element.rowIndex,
        element.columnIndex
      );
      if (!EditableGrid.isSame(newValue, previousValue)) {
        this.editablegrid.modelChanged(
          element.rowIndex,
          element.columnIndex,
          previousValue,
          newValue,
          this.editablegrid.getRow(element.rowIndex)
        );
      }

      this._clearEditor(element);
      return true;
    }

    return false;
  }
}

export class TextCellEditor extends CellEditor {
  autoHeight: boolean;
  maxLength: number;
  fieldSize: number;

  constructor(size = -1, maxlen = -1, config = {}) {
    super();

    if (size) this.fieldSize = size;
    if (maxlen) this.maxLength = maxlen;
    if (config) this.init(config);

    this.autoHeight = true;
  }

  editorValue(value) {
    return value;
  }

  updateStyle(htmlInput) {
    // change style for invalid values
    if (this.column.isValid(this.getEditorValue(htmlInput)))
      EditableGrid.removeClassName(
        htmlInput,
        this.editablegrid.invalidClassName
      );
    else
      EditableGrid.addClassName(htmlInput, this.editablegrid.invalidClassName);
  }

  getEditor(element, value) {
    // create and initialize text field
    var htmlInput = document.createElement("input");
    htmlInput.setAttribute("type", "text");
    if (this.maxLength > 0)
      htmlInput.setAttribute("maxlength", String(this.maxLength));

    if (this.fieldSize > 0)
      htmlInput.setAttribute("size", String(this.fieldSize));
    else htmlInput.style.width = EditableGrid.autoWidth(element) + "px"; // auto-adapt width to cell, if no length specified

    var autoHeight = EditableGrid.autoHeight(element);
    if (this.autoHeight) htmlInput.style.height = autoHeight + "px"; // auto-adapt height to cell
    htmlInput.value = this.editorValue(value);

    // listen to keyup to check validity and update style of input field
    htmlInput.onkeyup = function(event) {
      $(this)[0]["celleditor"].updateStyle(this);
    };

    return htmlInput;
  }

  displayEditor(element, htmlInput) {
    // call base method
    //TODO call the base method properly
    CellEditor.prototype.displayEditor.call(
      this,
      element,
      htmlInput,
      -1 * EditableGrid.borderLeft(htmlInput),
      -1 * (EditableGrid.borderTop(htmlInput) + 1)
    );

    // update style of input field
    this.updateStyle(htmlInput);

    // select text
    htmlInput.select();
  }
}

export class NumberCellEditor extends TextCellEditor {
  type: any;
  constructor(type, config = {}) {
    super(-1, 32);
    this.type = type;
    this.init(config);
  }

  //editorValue is called in getEditor to initialize field
  editorValue(value) {
    return value === null || isNaN(value)
      ? ""
      : (value + "").replace(".", this.column.decimal_point);
  }

  //getEditorValue is called before passing to isValid and applyEditing
  getEditorValue(editorInput) {
    return editorInput.value.replace(",", ".");
  }

  //formatValue is called in applyEditing
  formatValue(value) {
    return this.type == "integer" ? parseInt(value) : parseFloat(value);
  }
}

export class ArrayCellEditor extends TextCellEditor {
  //TODO: clean up variable names
  constructor(config = {}) {
    super(-1, -1);

    this.init(config);
  }

  //editorValue is called in getEditor to initialize field
  editorValue(value) {
    return value === null ? "" : value;
  }

  //getEditorValue is called before passing to isValid and applyEditing
  getEditorValue(editorInput) {
    //this is the first call, so here the split is done
    //TODO add some proper error checking here

    var value = editorInput.value.trim();

    if (value === "") {
      return [];
    }

    return editorInput.value.split(",");
  }
}

export class SelectCellEditor extends CellEditor {
  adaptWidth: boolean;
  adaptHeight: boolean;
  minHeight: number;
  minWidth: number;

  constructor(config = {}) {
    super();

    this.minWidth = 75;
    this.minHeight = 22;
    this.adaptHeight = true;
    this.adaptWidth = true;
    this.init(config);
  }

  isValueSelected(htmlInput, optionValue, value) {
    return (!optionValue && !value) || optionValue == value;
  }
  getEditor(element, value) {
    var self = this;

    // create select list
    var htmlInput = document.createElement("select");

    // auto adapt dimensions to cell, with a min width
    if (this.adaptWidth)
      htmlInput.style.width =
        Math.max(this.minWidth, EditableGrid.autoWidth(element)) + "px";
    if (this.adaptHeight)
      htmlInput.style.height =
        Math.max(this.minHeight, EditableGrid.autoHeight(element)) + "px";

    // get column option values for this row
    var optionValues = this.column.getOptionValuesForEdit(element.rowIndex);

    // add these options, selecting the current one
    var index = 0,
      valueFound = false;
    for (
      var optionIndex = 0;
      optionIndex < optionValues.length;
      optionIndex++
    ) {
      var optionValue = optionValues[optionIndex];

      // if values are grouped
      if (typeof optionValue.values == "object") {
        var optgroup = document.createElement("optgroup");
        optgroup.label = optionValue.label;
        htmlInput.appendChild(optgroup);

        for (
          var groupOptionIndex = 0;
          groupOptionIndex < optionValue.values.length;
          groupOptionIndex++
        ) {
          var groupOptionValue = optionValue.values[groupOptionIndex];
          var option = document.createElement("option");
          option.text = groupOptionValue.label;
          option.value = groupOptionValue.value ? groupOptionValue.value : ""; // this otherwise changes a null into a "null" !
          optgroup.appendChild(option);
          if (this.isValueSelected(htmlInput, groupOptionValue.value, value)) {
            option.selected = true;
            valueFound = true;
          } else option.selected = false;
          index++;
        }
      } else {
        var option = document.createElement("option");
        option.text = optionValue.label;
        option.value = optionValue.value ? optionValue.value : ""; // this otherwise changes a null into a "null" !
        // add does not work as expected in IE7 (cf. second arg)
        try {
          htmlInput.add(option, null);
        } catch (e) {
          htmlInput.add(option);
        }
        if (this.isValueSelected(htmlInput, optionValue.value, value)) {
          option.selected = true;
          valueFound = true;
        } else option.selected = false;
        index++;
      }
    }

    // if the current value is not in the list add it to the front
    if (!valueFound) {
      var option = document.createElement("option");
      option.text = value ? value : "";
      option.value = value ? value : "";
      // add does not work as expected in IE7 (cf. second arg)
      try {
        htmlInput.add(option, htmlInput.options[0]);
      } catch (e) {
        htmlInput.add(option);
      }
      htmlInput.selectedIndex = 0;
    }

    // when a new value is selected we apply it
    htmlInput.onchange = function(event) {
      this.onblur = null;
      $(this)[0]["celleditor"].applyEditing(
        $(this)[0]["element"],
        self.getEditorValue(this)
      );
    };

    return htmlInput;
  }
}

export class DateCellEditor extends TextCellEditor {
  constructor(config) {
    super();
    // erase defaults with given options
    this.init(config);
  }

  //redefine displayEditor to setup datepicker
  displayEditor(element, htmlInput) {
    // call base method
    TextCellEditor.prototype.displayEditor.call(this, element, htmlInput);

    let options: JQueryUI.DatepickerOptions = {
      dateFormat: "mm/dd/yy",
      changeMonth: true,
      changeYear: true,
      yearRange: "c-100:c+10",
      beforeShow: function(input, inst) {
        // the field cannot be blurred until the datepicker has gone away
        // otherwise we get the "missing instance data" exception
        this.onblur_backup = this.onblur;
        this.onblur = null;

        return {};
      },
      onClose: function(dateText, inst) {
        // apply date if any, otherwise call original onblur event
        if (dateText != "")
          this.celleditor.applyEditing(htmlInput.element, dateText);
        else if (this.onblur_backup != null) this.onblur_backup();
      }
    };

    jQuery(htmlInput)
      .datepicker(options)
      .datepicker("show");
  }
}
