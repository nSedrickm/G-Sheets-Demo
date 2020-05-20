var { google } = require('googleapis');
var { OAuth2Client } = require('google-auth-library');
var util = require('util');

var SheetsHelper = function (accessToken) {
    var auth = new OAuth2Client();
    auth.credentials = {
        access_token: accessToken
    };
    this.service = google.sheets({ version: 'v4', auth: auth });
};


SheetsHelper.prototype.createSpreadsheet = function (title, callback) {
    var self = this;
    var request = {
        resource: {
            properties: {
                title: title
            },
            sheets: [
                {
                    properties: {
                        title: 'Data',
                        gridProperties: {
                            columnCount: 6,
                            frozenRowCount: 1
                        }
                    }
                },
                // TODO: Add more sheets.
                
            ]
        }
    };
    self.service.spreadsheets.create(request, function (err, response) {
        if (err) {
            return callback(err);
        }
        var spreadsheet = response.data;
        // TODO: Add header rows.
        var dataSheetId = spreadsheet.sheets[0].properties.sheetId;
        var requests = [
            buildHeaderRowRequest(dataSheetId),
        ];
        // TODO: Add pivot table and chart.

        var request = {
            spreadsheetId: spreadsheet.spreadsheetId,
            resource: {
                requests: requests
            }
        };
        self.service.spreadsheets.batchUpdate(request, function (err, response) {
            if (err) {
                return callback(err);
            }
            return callback(null, spreadsheet);
        });
    });
};

SheetsHelper.prototype.sync = function (spreadsheetId, sheetId, orders, callback) {
    var requests = [];
    // Resize the sheet.
    requests.push({
        updateSheetProperties: {
            properties: {
                sheetId: sheetId,
                gridProperties: {
                    rowCount: orders.length + 1,
                    columnCount: COLUMNS.length
                }
            },
            fields: 'gridProperties(rowCount,columnCount)'
        }
    });
    // Set the cell values.
    requests.push({
        updateCells: {
            start: {
                sheetId: sheetId,
                rowIndex: 1,
                columnIndex: 0
            },
            rows: buildRowsForOrders(orders),
            fields: '*'
        }
    });
    // Send the batchUpdate request.
    var request = {
        spreadsheetId: spreadsheetId,
        resource: {
            requests: requests
        }
    };
    this.service.spreadsheets.batchUpdate(request, function (err) {
        if (err) {
            return callback(err);
        }
        return callback();
    });
};

var COLUMNS = [
    { field: 'id', header: 'ID' },
    { field: 'name', header: 'Client Name' },
    { field: 'token', header: 'Token' },
    { field: 'date', header: 'Date' }
];

function buildHeaderRowRequest(sheetId) {
    var cells = COLUMNS.map(function (column) {
        return {
            userEnteredValue: {
                stringValue: column.header
            },
            userEnteredFormat: {
                textFormat: {
                    bold: true
                }
            }
        }
    });
    return {
        updateCells: {
            start: {
                sheetId: sheetId,
                rowIndex: 0,
                columnIndex: 0
            },
            rows: [
                {
                    values: cells
                }
            ],
            fields: 'userEnteredValue,userEnteredFormat.textFormat.bold'
        }
    };
}

function buildRowsForOrders(orders) {
    return orders.map(function (order) {
        var cells = COLUMNS.map(function (column) {
            switch (column.field) {
                case 'status':
                    return {
                        userEnteredValue: {
                            stringValue: order.status
                        },
                        dataValidation: {
                            condition: {
                                type: 'ONE_OF_LIST',
                                values: [
                                    { userEnteredValue: 'PENDING' },
                                    { userEnteredValue: 'SHIPPED' },
                                    { userEnteredValue: 'DELIVERED' }
                                ]
                            },
                            strict: true,
                            showCustomUi: true
                        }
                    };
                    break;
                default:
                    return {
                        userEnteredValue: {
                            stringValue: order[column.field].toString()
                        }
                    };
            }
        });
        return {
            values: cells
        };
    });
}

module.exports = SheetsHelper;
