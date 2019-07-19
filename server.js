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

const app = express();
app.use(cors());

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`App is up on ${PORT}`));

// API Routes

app.get('/location', getLocation);

app.get('/weather', getWeather);

app.get('/yelp', getYelp);

// app.get('/events', getData);

// app.get('/movies', getData);

// app.get('/trails', getData);

// ---------- LOCATION ------------- //


// Route Handler
function getLocation(request, response) {

  const locationHandler = {

    query: request.query.data,

    cacheHit: (results) => {
      console.log('Got data from SQL');
      response.send(results.rows[0]);
    },

    cacheMiss: () => {
      Location.fetchLocation(request.query.data)
        .then(data => response.send(data));
    },
  };

  Location.lookupLocation(locationHandler);

}

// Constructor / Normalizer
function Location(query, data) {
  this.search_query = query;
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}

// Instance Method: Save a location to the DB
Location.prototype.save = function () {
  let SQL = `
    INSERT INTO locations
      (search_query,formatted_query,latitude,longitude) 
      VALUES($1,$2,$3,$4) 
      RETURNING id
  `;
  let values = Object.values(this);
  return client.query(SQL, values);
};

// Static Method: Fetch a location from google
Location.fetchLocation = (query) => {
  const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(_URL)
    .then(data => {
      console.log('Got data from API');
      if (!data.body.results.length) { throw 'No Data'; }
      else {
        // Create an instance and save it
        let location = new Location(query, data.body.results[0]);
        return location.save()
          .then(result => {
            location.id = result.rows[0].id;
            return location;
          });
      }
    });
};

// Static Method: Lookup a location in the DB and invoke the proper callback methods based on what you find
Location.lookupLocation = (handler) => {

  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [handler.query];

  return client.query(SQL, values)
    .then(results => {
      if (results.rowCount > 0) {
        handler.cacheHit(results);
      }
      else {
        handler.cacheMiss();
      }
    })
    .catch(console.error);

};


// ---------- WEATHER ------------- //


// Route Handler
function getWeather(request, response) {
  const handler = {

    location: request.query.data,

    cacheHit: function (result) {
      response.send(result.rows);
    },

    cacheMiss: function () {
      Weather.fetch(request.query.data)
        .then(results => response.send(results))
        .catch(console.error);
    },
  };

  Weather.lookup(handler);

}

// Weather Constructor/Normalizer
function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

// Instance Method: Save a location to the DB
Weather.prototype.save = function (id) {
  const SQL = `INSERT INTO weathers (forecast, time, location_id) VALUES ($1, $2, $3);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
};

// Static Method: Lookup a location in the DB and invoke the proper callback methods based on what you find
// Question -- is anything in here other than the table name esoteric to weather? Is there an opportunity to DRY this out?
Weather.lookup = function (handler) {
  const SQL = `SELECT * FROM weathers WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if (result.rowCount > 0) {
        console.log('Got data from SQL');
        handler.cacheHit(result);
      } else {
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

// Static Method: Fetch a location from the weather API
Weather.fetch = function (location) {
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${location.latitude},${location.longitude}`;

  return superagent.get(url)
    .then(result => {
      const weatherSummaries = result.body.daily.data.map(day => {
        const summary = new Weather(day);
        summary.save(location.id);
        return summary;
      });
      return weatherSummaries;
    });
};


// ---------- Yelp ------------- //


// Route Handler
function getYelp(request, response) {
  const handler = {

    location: request.query.data,

    cacheHit: function (result) {
      response.send(result.rows);
    },

    cacheMiss: function () {
      Yelp.fetch(request.query.data)
        .then(results => response.send(results))
        .catch(console.error);
    },
  };

  Yelp.lookup(handler);

}

// Yelp Constructor/Normalizer
function Yelp(business) {
  this.name = business.name;
  this.url = business.url;
  this.image_url = business.image_url;
  this.rating = business.rating;
  this.price = business.price;
}

// Instance Method: Save a location to the DB
Yelp.prototype.save = function (id) {
  const SQL = `INSERT INTO yelps (name, url, image_url, rating, price, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
};

Yelp.lookup = function (handler) {
  const SQL = `SELECT * FROM yelps WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if (result.rowCount > 0) {
        console.log('Got data from SQL');
        handler.cacheHit(result);
      } else {
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};


Yelp.fetch = function (location) {
  const url = `https://api.yelp.com/v3/businesses/search?term="restaurants"&latitude=${location.latitude}&longitude=${location.longitude}`;

  return superagent.get(url)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then(result => {
      console.log('STARDATE2060', result.body.businesses[0].name);
      const yelpBusinesses = result.body.businesses.map(business => {
        const newYelp = new Yelp(business);
        newYelp.save(location.id);
        return newYelp;
      });
      return yelpBusinesses;
    });
};


// ---------- EVENTS ------------- //


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





function Event(eventObj) {
  this.link = eventObj.url;
  this.name = eventObj.name.text;
  this.event_date = Date(eventObj.start.local).split(' ').slice(0, 4).join(' ');
  this.summary = eventObj.summary;
}

function Movie(eventObj) {
  this.title = eventObj.url;
  this.image_url = eventObj.name.text;
  this.overview = Date(eventObj.start.local).split(' ').slice(0, 4).join(' ');
  this.released_on = eventObj.summary;
  this.total_votes = eventObj.summary;
  this.average_votes = eventObj.summary;
  this.popularity = eventObj.summary;
}

function Trail(eventObj) {
  this.name = eventObj.url;
  this.trail_url = eventObj.name.text;
  this.location = Date(eventObj.start.local).split(' ').slice(0, 4).join(' ');
  this.length = eventObj.summary;
  this.conditions = eventObj.summary;
  this.star_votes = eventObj.summary;
  this.condition_time = eventObj.summary;
  this.stars = eventObj.summary;
  this.condition_date = eventObj.summary;
  this.summary = eventObj.summary;
}






