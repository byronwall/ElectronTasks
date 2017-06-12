

class CellValidator {
    constructor(config = {}) {
        // default properties
        var props = { isValid: null };

        // override default properties with the ones given
        for (var p in props) if (typeof config != 'undefined' && typeof config[p] != 'undefined') this[p] = config[p];
    }

    isValid(value) {
        return true;
    };
}

export class NumberCellValidator extends CellValidator {
    type: any;

    constructor(type) {
        super();
        this.type = type;
    }

    isValid(value) {
        // check that it is a valid number
        if (isNaN(value)) return false;

        // for integers check that it's not a float
        if (this.type == "integer" && value != "" && parseInt(value) != parseFloat(value)) return false;

        // the integer or double is valid
        return true;
    };
}

export class EmailCellValidator extends CellValidator {
    constructor() {
        super();
    }

    isValid(value) {
        return value == "" || /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/.test(value);
    };
}

export class WebsiteCellValidator extends CellValidator {
    constructor() { super(); }

    isValid(value) {
        return value == "" || (value.indexOf(".") > 0 && value.indexOf(".") < (value.length - 2));
    };
}

export class DateCellValidator extends CellValidator {
    grid: any;

    constructor(grid) {
        super();
        this.grid = grid;
    }

    isValid(value) {
        return value == "" || typeof this.grid.checkDate(value) == "object";
    };
}

