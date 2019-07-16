'use strict'

require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');

const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/location', (request, response) => {
  try {
    if (request.query.data !== 'Lynnwood')
      throw { status: 500, responseText: 'Sorry, We only have data on Lynnwood' };
    const geoData = require('./data/geo.json');
    const location = new Location(request.query.data, geoData);
    response.send(location);
  } catch (error) {
    response.status(400).send({ 'error': error });
  }
});

app.get('/weather', (request, response) => {
  try {
    if (request.query.data !== 'Los Angeles')
      throw { status: 500, responseText: 'Sorry, We only have weather on Los Angeles' };
    const weatherData = require('./data/darksky.json');
    const weatherResponse = [];
    for (let i = 0; i < 8; i++) {
      weatherResponse.push(new Weather(request.query.data, weatherData, i));
    }

    response.send(weatherResponse);
  } catch (error) {
    response.status(400).send({ 'error': error });
  }
});

function Weather(query, weatherData, whatDay) {
  this.forcast = weatherData.daily.data[whatDay].summary;
  let tempTime = Date(weatherData.daily.data[whatDay].time).toString().split(' ');
  tempTime = tempTime.splice(0, 4).join(' ');
  this.time = tempTime;
}

function Location(query, geoData) {
  this.search_query = query;
  this.formatted_query = geoData.results[0].formatted_address;
  this.latitude = geoData.results[0].geometry.location.lat;
  this.longitude = geoData.results[0].geometry.location.lat;
}


app.listen(PORT, () => {
  console.log('Listening on port: ' + PORT);
})
