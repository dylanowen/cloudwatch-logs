module.exports.AwsPromise = class {
    constructor(awsScope) {
        this.awsScope = awsScope;

        for(let key in awsScope) {
            if (typeof awsScope[key] === 'function') {
                this[key] = this._run.bind(this, key);
            }
        }
    }

    _run(funKey, parameters) {
        if (funKey in this.awsScope) {
            return new Promise((resolve, reject) => {
                this.awsScope[funKey].call(this.awsScope, parameters, (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(data);
                    }
                });
            });
        }
        else {
            return Promise.reject('Invalid function key');
        }
    }
}