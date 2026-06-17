-- Rooted Phase 5: nationwide stopgap seed (one farmers market per state)
-- Run in Supabase SQL Editor after phase4_events.sql.
--
-- Temporary placeholder data until the USDA Local Food Directories API key is
-- available (see scripts/seedMarkets.ts). Places one public upcoming event in a
-- major city of every US state so a shopper anywhere sees nearby events.
--
-- Idempotent: re-running will not create duplicates (guarded by event name).
-- Also clears the original Austin sample events from phase4_events.sql.

delete from public.events
where name in (
  'Downtown Makers Market',
  'Riverside Craft Fair',
  'Holiday Night Market',
  'Farmers & Flea Sunday',
  'Private Vendor Preview (Draft)'
);

insert into public.events
  (name, description, organizer_name, start_datetime, end_datetime,
   address, city, state, latitude, longitude, event_status, visibility_status,
   parking_info, admission_info)
select
  v.name,
  v.description,
  v.organizer_name,
  now() + make_interval(days => v.day_offset, hours => 9)  as start_datetime,
  now() + make_interval(days => v.day_offset, hours => 13) as end_datetime,
  v.address,
  v.city,
  v.state,
  v.latitude,
  v.longitude,
  'upcoming',
  'public',
  v.parking_info,
  v.admission_info
from (
  values
    ('Birmingham Farmers Market', 'Local farmers, makers, and food vendors gather weekly in Birmingham.', 'Birmingham Market Association', '1 Market Pl', 'Birmingham', 'AL', 33.5186, -86.8104, 4, 'Public parking nearby.', 'Free admission.'),
    ('Anchorage Saturday Market', 'Alaskan growers and artisans with fresh produce and handmade goods.', 'Anchorage Market Association', '3rd Ave', 'Anchorage', 'AK', 61.2181, -149.9003, 5, 'Street parking available.', 'Free admission.'),
    ('Phoenix Public Market', 'Desert-grown produce, local makers, and food trucks in downtown Phoenix.', 'Phoenix Market Association', '721 N Central Ave', 'Phoenix', 'AZ', 33.4484, -112.0740, 6, 'Garage parking nearby.', 'Free admission.'),
    ('Little Rock Farmers Market', 'Arkansas farmers and crafters in the River Market district.', 'Little Rock Market Association', '400 President Clinton Ave', 'Little Rock', 'AR', 34.7465, -92.2896, 7, 'Lot parking available.', 'Free admission.'),
    ('Los Angeles Farmers Market', 'A sprawling market with produce, makers, and street food in LA.', 'Los Angeles Market Association', '6333 W 3rd St', 'Los Angeles', 'CA', 34.0522, -118.2437, 3, 'Paid lot parking.', 'Free admission.'),
    ('Cherry Creek Fresh Market', 'Colorado growers and artisans in the Cherry Creek neighborhood of Denver.', 'Denver Market Association', '3000 E 1st Ave', 'Denver', 'CO', 39.7392, -104.9903, 8, 'Garage parking nearby.', 'Free admission.'),
    ('Hartford Regional Market', 'New England farmers and food makers in Hartford.', 'Hartford Market Association', '101 Reserve Rd', 'Hartford', 'CT', 41.7658, -72.6734, 9, 'Free lot parking.', 'Free admission.'),
    ('Wilmington Farmers Market', 'Delaware growers and crafters along the Riverfront.', 'Wilmington Market Association', '815 Justison St', 'Wilmington', 'DE', 39.7391, -75.5398, 10, 'Riverfront parking.', 'Free admission.'),
    ('Miami Community Market', 'Tropical produce, makers, and food vendors in Miami.', 'Miami Market Association', '301 SE 3rd Ave', 'Miami', 'FL', 25.7617, -80.1918, 4, 'Paid garage parking.', 'Free admission.'),
    ('Atlanta Farmers Market', 'Georgia farmers and artisans in midtown Atlanta.', 'Atlanta Market Association', '999 Peachtree St NE', 'Atlanta', 'GA', 33.7490, -84.3880, 5, 'Street and garage parking.', 'Free admission.'),
    ('Honolulu Farmers Market', 'Island-grown produce and local makers in Honolulu.', 'Honolulu Market Association', '777 Ward Ave', 'Honolulu', 'HI', 21.3069, -157.8583, 6, 'Lot parking available.', 'Free admission.'),
    ('Boise Capital City Market', 'Idaho farmers and crafters in downtown Boise.', 'Boise Market Association', '8th St', 'Boise', 'ID', 43.6150, -116.2023, 7, 'Free street parking weekends.', 'Free admission.'),
    ('Chicago Green City Market', 'Midwest farmers and food makers near Lincoln Park.', 'Chicago Market Association', '1817 N Clark St', 'Chicago', 'IL', 41.8781, -87.6298, 3, 'Paid garage parking.', 'Free admission.'),
    ('Indianapolis City Market', 'Indiana growers and artisans in downtown Indianapolis.', 'Indianapolis Market Association', '222 E Market St', 'Indianapolis', 'IN', 39.7684, -86.1581, 8, 'Garage parking nearby.', 'Free admission.'),
    ('Des Moines Farmers Market', 'Iowa farmers and makers in the Court Avenue district.', 'Des Moines Market Association', '300 Court Ave', 'Des Moines', 'IA', 41.5868, -93.6250, 9, 'Street and ramp parking.', 'Free admission.'),
    ('Wichita Old Town Market', 'Kansas growers and crafters in Old Town Wichita.', 'Wichita Market Association', '835 E 1st St N', 'Wichita', 'KS', 37.6872, -97.3301, 10, 'Free lot parking.', 'Free admission.'),
    ('Louisville Farmers Market', 'Kentucky farmers and food makers near NuLu.', 'Louisville Market Association', '700 E Market St', 'Louisville', 'KY', 38.2527, -85.7585, 4, 'Street parking available.', 'Free admission.'),
    ('Crescent City Farmers Market', 'Louisiana growers and artisans in New Orleans.', 'New Orleans Market Association', '750 Carondelet St', 'New Orleans', 'LA', 29.9511, -90.0715, 5, 'Paid lot parking.', 'Free admission.'),
    ('Portland Maine Farmers Market', 'New England farmers and makers in Deering Oaks Park.', 'Portland Market Association', '1 Deering Oaks', 'Portland', 'ME', 43.6591, -70.2568, 6, 'Street parking nearby.', 'Free admission.'),
    ('Baltimore Farmers Market', 'Maryland farmers and crafters under the JFX.', 'Baltimore Market Association', '1100 Saratoga St', 'Baltimore', 'MD', 39.2904, -76.6122, 7, 'Garage parking nearby.', 'Free admission.'),
    ('Boston Public Market', 'New England growers and food makers in downtown Boston.', 'Boston Market Association', '100 Hanover St', 'Boston', 'MA', 42.3601, -71.0589, 3, 'Paid garage parking; T accessible.', 'Free admission.'),
    ('Detroit Eastern Market', 'Michigan farmers and artisans in the historic Eastern Market.', 'Detroit Market Association', '2934 Russell St', 'Detroit', 'MI', 42.3314, -83.0458, 8, 'Lot and street parking.', 'Free admission.'),
    ('Minneapolis Farmers Market', 'Minnesota farmers and makers near downtown Minneapolis.', 'Minneapolis Market Association', '312 E Lyndale Ave N', 'Minneapolis', 'MN', 44.9778, -93.2650, 9, 'Free lot parking.', 'Free admission.'),
    ('Jackson Farmers Market', 'Mississippi growers and crafters in downtown Jackson.', 'Jackson Market Association', '929 High St', 'Jackson', 'MS', 32.2988, -90.1848, 10, 'Free parking on-site.', 'Free admission.'),
    ('Kansas City River Market', 'Missouri farmers and food makers in the City Market.', 'Kansas City Market Association', '20 E 5th St', 'Kansas City', 'MO', 39.0997, -94.5786, 4, 'Lot parking available.', 'Free admission.'),
    ('Billings Farmers Market', 'Montana growers and artisans in downtown Billings.', 'Billings Market Association', '2722 3rd Ave N', 'Billings', 'MT', 45.7833, -108.5007, 5, 'Street parking available.', 'Free admission.'),
    ('Omaha Farmers Market', 'Nebraska farmers and makers in the Old Market.', 'Omaha Market Association', '511 S 11th St', 'Omaha', 'NE', 41.2565, -95.9345, 6, 'Garage parking nearby.', 'Free admission.'),
    ('Las Vegas Farmers Market', 'Nevada growers and food vendors in downtown Las Vegas.', 'Las Vegas Market Association', '525 E Fremont St', 'Las Vegas', 'NV', 36.1699, -115.1398, 7, 'Paid garage parking.', 'Free admission.'),
    ('Manchester Farmers Market', 'New Hampshire farmers and crafters in downtown Manchester.', 'Manchester Market Association', '1 Elm St', 'Manchester', 'NH', 42.9956, -71.4548, 8, 'Street parking available.', 'Free admission.'),
    ('Newark Farmers Market', 'New Jersey growers and makers in downtown Newark.', 'Newark Market Association', '1 Mulberry St', 'Newark', 'NJ', 40.7357, -74.1724, 9, 'Garage parking nearby.', 'Free admission.'),
    ('Albuquerque Growers Market', 'New Mexico farmers and artisans near Old Town.', 'Albuquerque Market Association', '2000 Mountain Rd NW', 'Albuquerque', 'NM', 35.0844, -106.6504, 10, 'Free lot parking.', 'Free admission.'),
    ('Union Square Greenmarket', 'New York growers and food makers in Union Square.', 'New York Market Association', 'E 17th St & Broadway', 'New York', 'NY', 40.7128, -74.0060, 3, 'Subway accessible; paid garages.', 'Free admission.'),
    ('Charlotte Regional Market', 'North Carolina farmers and crafters in Charlotte.', 'Charlotte Market Association', '1801 Yorkmont Rd', 'Charlotte', 'NC', 35.2271, -80.8431, 8, 'Free lot parking.', 'Free admission.'),
    ('Fargo Farmers Market', 'North Dakota growers and makers in downtown Fargo.', 'Fargo Market Association', '210 Broadway N', 'Fargo', 'ND', 46.8772, -96.7898, 9, 'Street parking available.', 'Free admission.'),
    ('Columbus Farmers Market', 'Ohio farmers and food vendors in the Short North.', 'Columbus Market Association', '59 Spruce St', 'Columbus', 'OH', 39.9612, -82.9988, 10, 'Garage parking nearby.', 'Free admission.'),
    ('Oklahoma City Farmers Market', 'Oklahoma growers and crafters in OKC.', 'Oklahoma City Market Association', '311 S Klein Ave', 'Oklahoma City', 'OK', 35.4676, -97.5164, 4, 'Free lot parking.', 'Free admission.'),
    ('Portland Saturday Market', 'Oregon farmers and artisans along the waterfront.', 'Portland Market Association', '2 SW Naito Pkwy', 'Portland', 'OR', 45.5152, -122.6784, 5, 'MAX accessible; paid parking.', 'Free admission.'),
    ('Reading Terminal Market', 'Pennsylvania growers and food makers in Philadelphia.', 'Philadelphia Market Association', '1136 Arch St', 'Philadelphia', 'PA', 39.9526, -75.1652, 6, 'Paid garage parking.', 'Free admission.'),
    ('Providence Farmers Market', 'Rhode Island farmers and crafters in downtown Providence.', 'Providence Market Association', '1 Sims Ave', 'Providence', 'RI', 41.8240, -71.4128, 7, 'Lot parking available.', 'Free admission.'),
    ('Charleston Farmers Market', 'South Carolina growers and makers in Marion Square.', 'Charleston Market Association', '329 Meeting St', 'Charleston', 'SC', 32.7765, -79.9311, 8, 'Garage parking nearby.', 'Free admission.'),
    ('Sioux Falls Farmers Market', 'South Dakota farmers and artisans in downtown Sioux Falls.', 'Sioux Falls Market Association', '200 N Phillips Ave', 'Sioux Falls', 'SD', 43.5446, -96.7311, 9, 'Free street parking.', 'Free admission.'),
    ('Nashville Farmers Market', 'Tennessee growers and food makers near Germantown.', 'Nashville Market Association', '900 Rosa L Parks Blvd', 'Nashville', 'TN', 36.1627, -86.7816, 10, 'Free lot parking.', 'Free admission.'),
    ('Austin Farmers Market', 'Texas farmers and makers in downtown Austin.', 'Austin Market Association', '422 Guadalupe St', 'Austin', 'TX', 30.2672, -97.7431, 4, 'Paid garage parking.', 'Free admission.'),
    ('Salt Lake City Farmers Market', 'Utah growers and crafters in Pioneer Park.', 'Salt Lake City Market Association', '350 S 300 W', 'Salt Lake City', 'UT', 40.7608, -111.8910, 5, 'Street parking available.', 'Free admission.'),
    ('Burlington Farmers Market', 'Vermont farmers and artisans in City Hall Park.', 'Burlington Market Association', '149 Church St', 'Burlington', 'VT', 44.4759, -73.2121, 6, 'Garage parking nearby.', 'Free admission.'),
    ('Richmond Farmers Market', 'Virginia growers and makers in Shockoe Bottom.', 'Richmond Market Association', '100 N 17th St', 'Richmond', 'VA', 37.5407, -77.4360, 7, 'Lot parking available.', 'Free admission.'),
    ('Pike Place Farmers Market', 'Washington farmers and food makers at Pike Place.', 'Seattle Market Association', '85 Pike St', 'Seattle', 'WA', 47.6062, -122.3321, 3, 'Paid garage parking.', 'Free admission.'),
    ('Charleston WV Farmers Market', 'West Virginia growers and crafters in Capitol Market.', 'Charleston WV Market Association', '800 Smith St', 'Charleston', 'WV', 38.3498, -81.6326, 8, 'Free lot parking.', 'Free admission.'),
    ('Milwaukee Public Market', 'Wisconsin farmers and makers in the Historic Third Ward.', 'Milwaukee Market Association', '400 N Water St', 'Milwaukee', 'WI', 43.0389, -87.9065, 9, 'Garage parking nearby.', 'Free admission.'),
    ('Cheyenne Farmers Market', 'Wyoming growers and artisans in downtown Cheyenne.', 'Cheyenne Market Association', '121 W 15th St', 'Cheyenne', 'WY', 41.1400, -104.8202, 10, 'Free street parking.', 'Free admission.')
) as v(name, description, organizer_name, address, city, state, latitude, longitude, day_offset, parking_info, admission_info)
where not exists (
  select 1 from public.events e where e.name = v.name
);
