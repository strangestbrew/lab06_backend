DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS locations;

CREATE TABLE locations ( 
    id SERIAL PRIMARY KEY, 
    search_query VARCHAR(255), 
    formatted_query VARCHAR(255), 
    latitude NUMERIC(10, 7), 
    longitude NUMERIC(10, 7)
  );

CREATE TABLE weathers ( 
    id SERIAL PRIMARY KEY, 
    forecast VARCHAR(255), 
    time VARCHAR(255), 
    location_id INTEGER NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations (id)
  );

-- function Yelp(day) {
--   this.name = day.summary;
--   this.url = day.summary;
--   this.image_url = day.summary;
--   this.rating = day.summary;
--   this.price = day.summary;

CREATE TABLE yelps ( 
    id SERIAL PRIMARY KEY, 
    name VARCHAR(255), 
    url VARCHAR(255), 
    image_url VARCHAR(255), 
    rating NUMERIC(10, 7), 
    price VARCHAR(255), 
    location_id INTEGER NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations (id)
  );


-- }
-- function Event(eventObj) {
--   this.link = eventObj.url;
--   this.name = eventObj.name.text;
--   this.event_date = Date(eventObj.start.local).split(' ').slice(0, 4).join(' ');
--   this.summary = eventObj.summary;
-- }

CREATE TABLE events ( 
    id SERIAL PRIMARY KEY, 
    link VARCHAR(255), 
    name VARCHAR(255), 
    event_date VARCHAR(255), 
    summary VARCHAR(255), 
    location_id INTEGER NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations (id)
  );

-- function Movie(eventObj) {
--   this.title = eventObj.url;
--   this.image_url = eventObj.name.text;
--   this.overview = Date(eventObj.start.local).split(' ').slice(0, 4).join(' ');
--   this.released_on = eventObj.summary;
--   this.total_votes = eventObj.summary;
--   this.average_votes = eventObj.summary;
--   this.popularity = eventObj.summary;
-- }

CREATE TABLE movies ( 
    id SERIAL PRIMARY KEY, 
    title VARCHAR(255), 
    image_url VARCHAR(255), 
    overview VARCHAR(255), 
    released_on VARCHAR(255), 
    total_votes VARCHAR(255), 
    average_votes VARCHAR(255), 
    popularity VARCHAR(255), 
    location_id INTEGER NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations (id)
  );

-- function Trail(eventObj) {
--   this.name = eventObj.url;
--   this.trail_url = eventObj.name.text;
--   this.location = Date(eventObj.start.local).split(' ').slice(0, 4).join(' ');
--   this.length = eventObj.summary;
--   this.conditions = eventObj.summary;
--   this.star_votes = eventObj.summary;
--   this.condition_time = eventObj.summary;
--   this.stars = eventObj.summary;
--   this.condition_date = eventObj.summary;
--   this.summary = eventObj.summary;
-- }

CREATE TABLE movies ( 
    id SERIAL PRIMARY KEY, 
    name VARCHAR(255), 
    trail_url VARCHAR(255), 
    location VARCHAR(255), 
    length VARCHAR(255), 
    conditions VARCHAR(255), 
    star_votes VARCHAR(255), 
    condition_time VARCHAR(255), 
    stars VARCHAR(255), 
    condition_date VARCHAR(255), 
    summary VARCHAR(255), 
    location_id INTEGER NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations (id)
  );
