/*jshint esversion: 6 */
/*jslint node: true */
'use strict';

const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const m = require('./models/Measurement.js');
const c = require('./models/Config.js');
const d = require('./models/Device.js');
const wd = require('./models/WaitingDevice.js');
const Notifier = require('./Notifier.js');
const db = require('./db.js');
const temp = require('./temp.js');
const timer = require('./timer.js');
const power = require('./power.js');

//const url = process.env.MONGODB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost:27017/my_database_name';
const url = process.env.MONGODB_URI || process.env.MONGOHQ_URL || 'mongodb://local:loca123!@ds023325.mlab.com:23325/heroku_w1wkbjcz';
const port = process.env.PORT || 5000;

app.use('/public', express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());
app.use(Notifier.ticker);

app.set('port', port);
app.set('etag', false);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.use('/timer', require('./timer.js'));

app.get('/v2/measurement/:id', temp.measurements);
app.get('/measurement/:id/now', temp.now);
app.get('/measurement/:id/clean', temp.clean);
app.get('/measurement/:id', temp.readId);
app.post('/measurement/:id', temp.writeId);

app.post("/power/tick/:id", power.tick);
app.get("/power/:id", power.display);
app.get("/power/last/:id", power.powerConsumption);
app.get("/power/graph/:id", power.powerGraph);
app.get("/power/graph2/:id", power.powerGraph2);


app.get('/', async (req, resp) => {
  var id = "2c001f000147353138383138"; // TODO change this hardcoded value

  try {
    const value = await m.now(id)
    value.measurement = value.measurement.toFixed(1);
    resp.render('index', value);
  } catch (error) {
    console.log(error);
    resp.render('index', {
      "id" : "",
      "measurement" : "",
      "time": ""
    });
  }
});

app.get('/config', async (req, resp) => {
  try {
    const config = await c.read();
    resp.render('config', config);
  } catch(error) {
    console.log(error);
    resp.send(500);
  }
});

app.get('/deviceconfig', function(req, res) {
  let waitingDevices = [];
  wd.getAll().then(function(readWaitingDevices) {
    waitingDevices = readWaitingDevices
    return d.getAll()
  }).then(function(devices) {
    const data = {
      'waitingdevices': waitingDevices,
      'devices': devices
    };
    res.render('deviceconfig', data);
  }).fail(function(error) {
    res.status(500).send(error);
  });
});

app.get('/deviceconfig/:id', function(req, res) {
  const id = req.params.id;

  if (!id) {
    return res.status(400).send("missing id parameter");
  }

  d.read(id).then(function(device) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(device));
  }).fail(function(error) {
    if(error) {
      res.status(500).send(error);
    }

    wd.get(id).then(function(waitingdevice) {
      res.status(202).send();
    }).fail(function(error) {
      res.status(500).send(error);
    });
  });
});

app.post('/deviceconfig/:id', function(req, res) {
  let id = req.params.id;
  let name = req.body.deviceName;

  if (!id || !name) {
    return res.status(400).send("missing parameter");
  }

  d.create(id, name).then(function(device) {
    return wd.delete(id);
  }).then(function(config) {
    return res.redirect('/deviceconfig');
  }).fail(function(error) {
    res.status(500).send(error);
  });
});

app.get('/deviceconfig/:id/delete', function(req, res) {
  let id = req.params.id;

  if (!id) {
    return res.status(400).send("missing parameter");
  }

  d.delete(id).then(function(device) {
    return res.redirect('/deviceconfig');
  }).fail(function(error) {
    res.status(500).send(error);
  });
});

app.post('/config', async (req, res) => {
  try {
    const config = await c.read();
    config.username = req.body.username || config.username;
    config.password = req.body.password || config.password;
    config.tel = req.body.tel || config.tel;
    await config.save();
    res.redirect('/config');
  } catch (error) {
    console.log(error);
    res.send(500);
  }
});

db.connect(url, (err) => {
  if (err) {
    console.log('Unable to connect to Mongo.');
  } else {
    console.log('Connection established to', url);
    const server = app.listen(port, function() {
      const host = server.address().address;
      const port = server.address().port;
      console.log(`Listening at http://${host}:${port}`);
    });
  }
});
