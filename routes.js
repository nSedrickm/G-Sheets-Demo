
'use strict';

var express = require('express');
var router = express.Router();
var models = require('./models');
var Sequelize = require('sequelize');

// TODO: Show spreadsheets on the main page.
router.get('/', function (req, res, next) {
  var options = {
    client: [['createdAt', 'DESC']],
    raw: true
  };
  Sequelize.Promise.all([
    models.Client.findAll(options),
<<<<<<< HEAD
    models.Spreadsheet.findAll(options)
=======
    //models.Spreadsheet.findAll(options)
>>>>>>> displaying clients info from db
  ]).then(function (results) {
    /* debug line for clients in db
     console.log(results[0]); */
    res.render('index', {
      clients: results[0],
      spreadsheets: results[1]
    });
  });
});

router.get('/create', function (req, res, next) {
  res.render('upsert');
});

router.get('/edit/:id', function (req, res, next) {
  models.Client.findByPk(req.params.id).then(function (client) {
    if (client) {
      res.render('upsert', {
        client: client.toJSON()
      });
    } else {
      next(new Error('Client not found: ' + req.params.id));
    }
  });
});

router.get('/delete/:id', function (req, res, next) {
  models.Client.findByPk(req.params.id)
    .then(function (client) {
      if (!client) {
        throw new Error('Client not found: ' + req.params.id);
      }
      return client.destroy();
    })
    .then(function () {
      res.redirect('/');
    }, function (err) {
      next(err);
    });
});

router.post('/upsert', function (req, res, next) {
  models.Client.upsert(req.body).then(function () {
    res.redirect('/');
  }, function (err) {
    next(err);
  });
});

// TODO: Add route for creating spreadsheet.
var SheetsHelper = require('./sheets');

router.post('/spreadsheets', function (req, res, next) {
  var auth = req.get('Authorization');
  if (!auth) {
    return next(Error('Authorization required.'));
  }
  var accessToken = auth.split(' ')[1];
  var helper = new SheetsHelper(accessToken);
  var title = 'Clients (' + new Date().toLocaleTimeString() + ')';
  helper.createSpreadsheet(title, function (err, spreadsheet) {
    if (err) {
      return next(err);
    }
    var model = {
      id: spreadsheet.spreadsheetId,
      sheetId: spreadsheet.sheets[0].properties.sheetId,
      name: spreadsheet.properties.title
    };
    models.Spreadsheet.create(model).then(function () {
      return res.json(model);
    });
  });
});

// TODO: Add route for syncing spreadsheet.

router.post('/spreadsheets/:id/sync', function (req, res, next) {
  var auth = req.get('Authorization');
  if (!auth) {
    return next(Error('Authorization required.'));
  }
  var accessToken = auth.split(' ')[1];
  var helper = new SheetsHelper(accessToken);
  Sequelize.Promise.all([
    models.Spreadsheet.findByPk(req.params.id),
    models.Client.findAll()
  ]).then(function (results) {
    var spreadsheet = results[0];
    var clients = results[1];
    helper.sync(spreadsheet.id, spreadsheet.sheetId, clients, function (err) {
      if (err) {
        return next(err);
      }
      return res.json(clients.length);
    });
  });
});

module.exports = router;
