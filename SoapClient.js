/**
 * create by ikejcwang on 2022.03.07.
 */
'use strict';
const soap = require('soap');
const soapOptions = {
    disableCache: true,
    escapeXML: false
}

/**
 * 构造自定义的soap类
 */
class SoapClient {

    constructor(config) {
        this.server = config.server;
        this.init()
    }

    init() {
        soap.createClientAsync(`${this.server}?wsdl`, soapOptions).then(client => {
            this.client = client
        }).catch(err => {
            this.err = err
        })
    }

    request(body, method) {
        return new Promise((resolve, reject) => {
            if (this.err) {
                reject(this.err)
            } else {
                if (!this.client[method]) {
                    reject(new Error('soap client does not support this method: ${method}'))
                } else {
                    this.client[method](body, (err, result, rawResponse, soapHeader, rawRequest) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(result)
                        }
                    })
                }
            }
        })
    }
}

module.exports = SoapClient