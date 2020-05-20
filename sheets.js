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
                {
                    properties: {
                        title: 'Pivot',
                        gridProperties: {
                            hideGridlines: true
                        }
                    }
                }
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
        var pivotSheetId = spreadsheet.sheets[1].properties.sheetId;
        requests = requests.concat([
            buildPivotTableRequest(dataSheetId, pivotSheetId),
            buildFormatPivotTableRequest(pivotSheetId),
            buildAddChartRequest(pivotSheetId)
        ]);
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

SheetsHelper.prototype.sync = function (spreadsheetId, sheetId, clients, callback) {
    var requests = [];
    // Resize the sheet.
    requests.push({
        updateSheetProperties: {
            properties: {
                sheetId: sheetId,
                gridProperties: {
                    rowCount: clients.length + 1,
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
            rows: buildRowsForClients(clients),
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
    { field: 'clientName', header: 'Client Name' },
    { field: 'clientTel', header: 'Client Tel' },
    { field: 'clientAddress', header: 'Client Address' },
    { field: 'status', header: 'Status' }
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

function buildRowsForClients(clients) {
    return clients.map(function (client) {
        var cells = COLUMNS.map(function (column) {
            switch (column.field) {
                case 'status':
                    return {
                        userEnteredValue: {
                            stringValue: client.status
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
                            stringValue: client[column.field].toString()
                        }
                    };
            }
        });
        return {
            values: cells
        };
    });
}

function buildPivotTableRequest(sourceSheetId, targetSheetId) {
    return {
        updateCells: {
            start: { sheetId: targetSheetId, rowIndex: 0, columnIndex: 0 },
            rows: [
                {
                    values: [
                        {
                            pivotTable: {
                                source: {
                                    sheetId: sourceSheetId,
                                    startRowIndex: 0,
                                    startColumnIndex: 0,
                                    endColumnIndex: COLUMNS.length
                                },
                                rows: [
                                    {
                                        sourceColumnOffset: getColumnForField('productCode').index,
                                        showTotals: false,
                                        sortOrder: 'ASCENDING'
                                    }
                                ],
                                values: [
                                    {
                                        summarizeFunction: 'SUM',
                                        sourceColumnOffset: getColumnForField('unitsOrdered').index
                                    },
                                    {
                                        summarizeFunction: 'SUM',
                                        name: 'Revenue',
                                        formula: util.format("='%s' * '%s'",
                                            getColumnForField('unitsOrdered').header,
                                            getColumnForField('unitPrice').header)
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            fields: '*'
        }
    };
}

function buildFormatPivotTableRequest(sheetId) {
    return {
        repeatCell: {
            range: { sheetId: sheetId, startRowIndex: 1, startColumnIndex: 2 },
            cell: {
                userEnteredFormat: {
                    numberFormat: { type: 'CURRENCY', pattern: '"$"#,##0.00' }
                }
            },
            fields: 'userEnteredFormat.numberFormat'
        }
    };
}

function buildAddChartRequest(sheetId) {
    return {
        addChart: {
            chart: {
                spec: {
                    title: 'Revenue per Product',
                    basicChart: {
                        chartType: 'BAR',
                        legendPosition: 'RIGHT_LEGEND',
                        domains: [
                            // Show a bar for each product code in the pivot table.
                            {
                                domain: {
                                    sourceRange: {
                                        sources: [{
                                            sheetId: sheetId,
                                            startRowIndex: 0,
                                            startColumnIndex: 0,
                                            endColumnIndex: 1
                                        }]
                                    }
                                }
                            }
                        ],
                        series: [
                            // Set that bar's length based on the total revenue.
                            {
                                series: {
                                    sourceRange: {
                                        sources: [{
                                            sheetId: sheetId,
                                            startRowIndex: 0,
                                            startColumnIndex: 2,
                                            endColumnIndex: 3
                                        }]
                                    }
                                }
                            }
                        ]
                    }
                },
                position: {
                    overlayPosition: {
                        anchorCell: { sheetId: sheetId, rowIndex: 0, columnIndex: 3 },
                        widthPixels: 600,
                        heightPixels: 400
                    }
                }
            }
        }
    };
}

function getColumnForField(field) {
    return COLUMNS.reduce(function (result, column, i) {
        if (column.field == field) {
            column.index = i;
            return column;
        }
        return result;
    });
}

module.exports = SheetsHelper;
