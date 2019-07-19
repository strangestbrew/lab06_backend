'use strict';


// #region -------------------- SETUP --------------------

// Application Dependencies
const express = require('express');
const superagent = require('superagent');
const pg = require('pg');
const cors = require('cors');

// Load environment variables from .env file
require('dotenv').config();

// Application Setup
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Database Setup
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// API Routes
app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/events', getEvents);
app.get('/yelp', getYelp);
app.get('/movies', getMovies);
// app.get('/trails', getTrails);

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// #endregion SETUP


// #region -------------------- HELPER FUNCTIONS --------------------

// Error handler
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// Look for the results in the database
function lookup(options) {
  const SQL = `SELECT * FROM ${options.tableName} WHERE location_id=$1;`;
  const values = [options.location];
  console.log(options.tableName, options.location);

  client.query(SQL, values)
    .then(result => {
      if (result.rowCount > 0) {
        options.cacheHit(result);
      } else {
        options.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

function deleteByLocationId(table, city) {
  const SQL = `DELETE from ${table} WHERE location_id=${city};`;
  return client.query(SQL);
}

const timeouts = {
  weathers: 15 * 1000,
  events: 15 * 1000,
  yelps: 15 * 1000,
  movies: 15 * 1000,
  trails: 15 * 1000
}

// #endregion HELPER FUNCTIONS


// #region -------------------- LOCATION --------------------

// Models
function Location(query, res) {
  this.tableName = 'locations';
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
}

Location.lookupLocation = (location) => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
  const values = [location.query];

  return client.query(SQL, values)
    .then(result => {
      if (result.rowCount > 0) {
        location.cacheHit(result);
      } else {
        location.cacheMiss();
      }
    })
    .catch(console.error);
};

Location.prototype = {
  save: function () {
    const SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id;`;
    const values = [this.search_query, this.formatted_query, this.latitude, this.longitude];

    return client.query(SQL, values)
      .then(result => {
        this.id = result.rows[0].id;
        return this;
      });
  }
};


function getLocation(request, response) {
  Location.lookupLocation({
    tableName: Location.tableName,

    query: request.query.data,

    cacheHit: function (result) {
      response.send(result.rows[0]);
    },

    cacheMiss: function () {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${this.query}&key=${process.env.GEOCODE_API_KEY}`;

      return superagent.get(url)
        .then(result => {
          const location = new Location(this.query, result);
          location.save()
            .then(location => response.send(location));
        })
        .catch(error => handleError(error));
    }
  });
}

// #endregion LOCATION


// #region -------------------- WEATHER --------------------


function Weather(day) {
  this.tableName = 'weathers';
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.created_at = Date.now();
}

Weather.tableName = 'weathers';
Weather.lookup = lookup;
Weather.deleteByLocationId = deleteByLocationId;

Weather.prototype.save = function (location_id) {
  const SQL = `INSERT INTO ${this.tableName} (forecast, time, created_at, location_id) VALUES ($1, $2, $3, $4);`;
  const values = [this.forecast, this.time, this.created_at, location_id];

  client.query(SQL, values);
};

function getWeather(request, response) {
  Weather.lookup({
    tableName: Weather.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      let ageOfResults = (Date.now() - result.rows[0].created_at);
      if (ageOfResults > timeouts.weathers) {
        console.log('Stale weather data for location: ', request.query.data.search_query);
        Weather.deleteByLocationId(Weather.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(result.rows);
      }
    },

    cacheMiss: function () {
      const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

      superagent.get(url)
        .then(result => {
          const weatherSummaries = result.body.daily.data.map(day => {
            const summary = new Weather(day);
            summary.save(request.query.data.id);
            return summary;
          });
          response.send(weatherSummaries);
        })
        .catch(error => handleError(error, response));
    }
  });
}

// #endregion WEATHER


// #region -------------------- EVENT --------------------

function Event(event) {
  this.tableName = 'events';
  this.link = event.url;
  this.name = event.name.text;
  this.event_date = new Date(event.start.local).toString().slice(0, 15);
  this.summary = event.summary;
}

Event.tableName = 'events';
Event.lookup = lookup;

Event.prototype.save = function (location_id) {
  const SQL = `INSERT INTO ${this.tableName} (link, name, event_date, summary, location_id) VALUES ($1, $2, $3, $4, $5);`;
  const values = [this.link, this.name, this.event_date, this.summary, location_id];

  client.query(SQL, values);
};


function getEvents(request, response) {
  Event.lookup({
    tableName: Event.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      response.send(result.rows);
    },

    cacheMiss: function () {
      const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.EVENTBRITE_API_KEY}&location.address=${request.query.data.formatted_query}`;

      superagent.get(url)
        .then(result => {
          const events = result.body.events.map(eventData => {
            const event = new Event(eventData);
            event.save(request.query.data.id);
            return event;
          });

          response.send(events);
        })
        .catch(error => handleError(error, response));
    }
  });
}


// #endregion EVENT


// #region -------------------- MOVIE --------------------


function Movie(movieObj) {
  this.title = movieObj.title;
  this.overview = movieObj.overiew;
  this.average_votes = movieObj.vote_average;
  this.total_votes = movieObj.vote_count;
  this.image_url = `http://image.tmdb.org/t/p/w185${movieObj.poster_path}`;
  this.popularity = movieObj.popularity;
  this.released_on = movieObj.release_date;
}


Movie.tableName = 'movies';
Movie.lookup = lookup;

Movie.prototype.save = function (location_id) {
  const SQL = `INSERT INTO ${Movie.tableName} (title, overview, average_votes, total_votes, image_url, popularity, released_on, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`;
  const values = [this.title, this.overview, this.average_votes, this.total_votes, this.image_url, this.popularity, this.released_on, location_id];

  client.query(SQL, values);
};


function getMovies(request, response) {
  Movie.lookup({
    tableName: Movie.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      response.send(result.rows);
    },

    cacheMiss: function () {
      const url = `https://api.themoviedb.org/3/discover/movie/?sort_by=popularity.desc&api_key=${process.env.MOVIE_API_KEY}`;

      superagent.get(url)
        .then(result => {
          // console.log(Object.values(result.body.results[0]));
          const movies = result.body.results.map(movieData => {
            const movie = new Movie(movieData);
            movie.save(request.query.data.id);
            return movie;
          });

          response.send(movies);
        })
        .catch(error => handleError(error, response));
    }
  });
}

// #endregion MOVIE


// #region -------------------- YELP --------------------

function Yelp(business) {
  this.name = business.name;
  this.image_url = business.image_url;
  this.price = business.price;
  this.rating = business.rating;
  this.url = business.url;
}


Yelp.tableName = 'yelps';
Yelp.lookup = lookup;

Yelp.prototype.save = function (location_id) {
  const SQL = `INSERT INTO ${Yelp.tableName} (name, image_url, price, rating, url, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
  const values = [this.name, this.image_url, this.price, this.rating, this.url, location_id];

  client.query(SQL, values);
};


function getYelp(request, response) {
  console.log('getYelp() Called');
  console.log('getYelp() request: ', request.query.data);

  Yelp.lookup({
    tableName: Yelp.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      response.send(result.rows);
    },

    cacheMiss: function () {
      console.log('getYelp() cacheMiss() Called');
      console.log('yelp location: ', request.query.data.id);
      const url = `https://api.yelp.com/v3/businesses/search?term="restaurants"&latitude=${location.latitude}&longitude=${location.longitude}`;

      superagent.get(url)
        .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
        .then(result => {
          console.log('getYelpAPI results: ', result.body.businesses);
          const yelpBusinesses = result.body.businesses.map(business => {
            const newYelp = new Yelp(business);
            newYelp.save(request.query.data.id);
            return newYelp;
          });

          response.send(yelpBusinesses);
        })
        .catch(error => handleError(error, response));
    }
  });
}


// #endregion YELP


// #region -------------------- TRAIL --------------------

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


// #endregion TRAIL


