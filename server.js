'use strict';

// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

// Application Setup
const PORT = process.env.PORT || 3000;
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));
//TODO: FIGURE OUT DATABASE URL

const app = express();
app.use(cors());


// API Routes

app.get('/location', getLocation);

app.get('/weather', getWeather);

app.get('/events', getEvents);

// Helper Functions

function getLocation(query) {

  // What must we do to cache the API results ...
  // Do we already have this in the database?
  //    If so, Return it to the client
  // If not
  //    Go to google and get it
  //    Add it to the database
  //    Return it to the client

  const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
  const values = [query];

  return client.query(SQL, values)
    .then(result => {
      if (result.rowCount > 0) {
        console.log('From SQL');
        return result.rows[0];
      } else {
        const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
        return superagent.get(_URL)
          .then(data => {
            console.log('FROM API');
            if (!data.body.results.length) { throw 'No Data'; }
            else {
              let location = new Location(query, data.body.results[0]);
              let NEWSQL = `INSERT INTO locations (search_query,formatted_query,latitude,longitude) VALUES($1,$2,$3,$4) RETURNING id`;
              let newValues = Object.values(location);
              return client.query(NEWSQL, newValues)
                .then(results => {
                  location.id = results.rows[0].id;
                  return location;
                })
                .catch(console.error);
            }
          });
      }
    })
    .catch(console.error);
}


//BEN'S searchToLatLong FUNCT
// function searchToLatLong(request, response) {
//   const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`
//   return superagent.get(url)
//     .then(res => {
//       const location = new Location(request.query.data, JSON.parse(res.text));
//       response.send(location);
//     })
//     .catch(err => {
//       response.send(err);
//     });
// }



function getWeather(request, response) {
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`

  return superagent.get(url)
    .then(res => {
      const weatherEntries = res.body.daily.data.map(day => {
        return new Weather(day);
      })

      response.send(weatherEntries);
    })
    .catch(error => {
      response.send(error);
    });
}

function getEvents(request, response) {
  const url = `https://www.eventbriteapi.com/v3/events/search?location.latitude=${request.query.data.latitude}&location.longitude=${request.query.data.longitude}&token=${process.env.EVENTBRITE_API_KEY}`

  return superagent.get(url)
    .then(res => {
      const eventEntries = res.body.events.map(eventObj => {
        return new Event(eventObj);
      })
      response.send(eventEntries);
    })
    .catch(err => {
      response.send(err);
    });
}


// Constructors - Data Formatters

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.results[0].formatted_address;
  this.latitude = res.results[0].geometry.location.lat;
  this.longitude = res.results[0].geometry.location.lng;
  
}

//saving locations to database
Location.prototype.save = function() {
  let SQL = `
    INSERT INTO locations
    (serch_query, formatted_query, latitude, longitude)
    VALUES($1,$2,$3,$4)
    RETURNING id
  `;
  let values = Object.values(this);
  return client.query(SQL,values);
}

// const newLocal = Location.lookupLocation = (handler) => {
//   const SQL = `SELECT * FROM locations WHERE search_query=$1`;
//   const values = [handler.query];
//   return client.query(SQL, values)
//     .then(results => {
//       if (results.rowCount > 0) {
//         handler.cacheHit(results);
//       }
//       else {
//         handler.cacheMiss();
//       }
//     })
//     .catch(console.error);
// };

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

function Event(eventObj) {
  this.link = eventObj.url;
  this.name = eventObj.name.text;
  this.event_date = Date(eventObj.start.local).split(' ').slice(0, 4).join(' ');
  this.summary = eventObj.summary;

}

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`App is up on ${PORT}`));
