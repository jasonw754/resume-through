class ResumeThrough {
    constructor(options, chunk) {
        this._options = options;
        this._chunk = chunk;

        this._id = null;
    }

    get id() {
        if (this._id == null) {
            if (typeof this._options.identifier === 'function') {
                this._id = this._options.identifier();
            } else if (typeof this._options.identifier === 'string') {
                this._id = this._chunk[this._options.identifier];
            }
        }
        return this._id;
    }
}

module.exports = ResumeThrough;