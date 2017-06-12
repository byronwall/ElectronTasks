import { CellEditor } from 'grid/Editors';
import {EditableGrid} from 'grid/EditableGrid';

export class Column {
    cellEditor: CellEditor;
    datatype: string;
    cellValidators: any;
    optionValues: any;
    optionValuesForRender: any;
    editablegrid: any;
    name: any;
    enumProvider: any;

    constructor(config) {
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

    getOptionValuesForRender(rowIndex) {
        if (!this.enumProvider) {
            console.log('getOptionValuesForRender called on column ' + this.name + ' but there is no EnumProvider');
            return null;
        }
        var values = this.enumProvider.getOptionValuesForRender(this.editablegrid, this, rowIndex);
        return values ? values : this.optionValuesForRender;
    };

    getOptionValuesForEdit(rowIndex) {
        if (!this.enumProvider) {
            console.log('getOptionValuesForEdit called on column ' + this.name + ' but there is no EnumProvider');
            return null;
        }
        var values = this.enumProvider.getOptionValuesForEdit(this.editablegrid, this, rowIndex);
        return values ? EditableGrid._convertOptions(values) : this.optionValues;
    };

    isValid(value) {
        for (var i = 0; i < this.cellValidators.length; i++) if (!this.cellValidators[i].isValid(value)) return false;
        return true;
    };

    isNumerical() {
        return this.datatype == 'double' || this.datatype == 'integer';
    };
}
