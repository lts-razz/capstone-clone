export type WoodberryPhotoGroupName =
  | 'Resort'
  | 'Events'
  | 'Pool'
  | 'Rooms'
  | 'Pavilion'
  | 'Amenities';

export interface WoodberryGalleryPhoto {
  src: string;
  alt: string;
  caption: string;
  featured?: 'tall' | 'wide';
}

export interface WoodberryPhotoGroup {
  name: WoodberryPhotoGroupName;
  description: string;
  photos: WoodberryGalleryPhoto[];
}

const publicPhotoPath = (...segments: string[]) =>
  `/woodbery_pics/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;

const photoPath = (...segments: string[]) => publicPhotoPath('property_photos', ...segments);

const day = (file: string) => photoPath('day', file);
const night = (file: string) => photoPath('night', file);
const room = (roomName: string, file: string) => photoPath('rooms', roomName, file);
const event = (folder: string, file: string) => publicPhotoPath('events', folder, file);

export const woodberryPhotos = {
  fallback: day('pool_and_house.jpg'),
  homeHero: night('Pool Night.jpg'),
  publicHero: day('pool_and_house.jpg'),
  eventsHero: event('wedding_celebration', 'wedding_celeb_stage_1.jpg'),
  amenitiesHero: day('Swimming_Pool_2.jpg'),
  roomsHero: room('Room 6', 'Room 6 Main Bed.jpg'),
  contactHero: night('Entrance Night.jpg'),
  dashboardHero: night('Pool Night.jpg'),
  eventCardFallback: event('blue_lunch', 'blue_lunch_hall_1.jpg'),
  venueDetailFallback: day('filled_hall_1.jpg'),
  authPanel: day('pool_and_house.jpg'),
  signinPanel: night('Pool Night.jpg'),
  signupPanel: day('tables_3.jpg'),
  resetPanel: night('Entrance Night.jpg'),
};

export const woodberryEventPhotos = {
  childrenParty: [
    {
      src: event('pink_birthday_party', 'pink_party_main_photo_1.jpg'),
      alt: "Pink themed children's birthday party photo area at Woodberry",
      caption: 'Birthday Photo Area',
    },
    {
      src: event('pink_birthday_party', 'pink_party_stage_1.jpg'),
      alt: "Decorated children's party stage with pastel balloons",
      caption: 'Pastel Party Stage',
    },
    {
      src: event('pink_birthday_party', 'pink_party_stage_2.jpg'),
      alt: "Children's party lounge and stage setup with pink decorations",
      caption: 'Stage Lounge Setup',
    },
    {
      src: event('pink_birthday_party', 'pink_party_tables_1.jpg'),
      alt: "Children's birthday party tables with colorful balloon decorations",
      caption: 'Guest Tables',
    },
    {
      src: event('pink_birthday_party', 'pink_party_cake_1.jpg'),
      alt: "Pink children's birthday cake display",
      caption: 'Cake Display',
    },
    {
      src: event('pink_birthday_party', 'pink_party_cake_2.jpg'),
      alt: "Tiered children's birthday cake with themed decorations",
      caption: 'Themed Cake',
    },
    {
      src: event('pink_birthday_party', 'pink_party_food_1.jpg'),
      alt: "Warm party food trays prepared for a children's birthday",
      caption: 'Party Food',
    },
    {
      src: event('pink_birthday_party', 'pink_party_food_2.jpg'),
      alt: "Seafood dish served for a children's party buffet",
      caption: 'Buffet Dish',
    },
    {
      src: event('pink_birthday_party', 'pink_party_food_3.jpg'),
      alt: "Assorted buffet tray served for a children's birthday party",
      caption: 'Assorted Buffet',
    },
    {
      src: event('pink_birthday_party', 'pink_party_food_4.jpg'),
      alt: "Chicken dish served for a children's birthday buffet",
      caption: 'Main Dish',
    },
    {
      src: event('pink_birthday_party', 'pink_party_food_5.jpg'),
      alt: "Fried party appetizer tray with dip for a children's birthday",
      caption: 'Party Appetizers',
    },
    {
      src: event('pink_birthday_party', 'pink_party_food_6.jpg'),
      alt: "Noodle tray served for a children's birthday party",
      caption: 'Birthday Noodles',
    },
    {
      src: event('pink_birthday_party', 'pink_party_poolside_1.jpg'),
      alt: "Poolside area beside a children's birthday celebration",
      caption: 'Poolside Celebration',
    },
  ],
  debut: [
    {
      src: event('debut', 'debut_main_stage_photo_1.jpg'),
      alt: 'Blue eighteenth birthday debut stage arranged at Woodberry',
      caption: 'Main Debut Stage',
    },
    {
      src: event('debut', 'debut_stage_1.jpg'),
      alt: 'Debut stage with blue and gold decorations',
      caption: 'Stage Details',
    },
    {
      src: event('debut', 'debut_entrance_1.jpg'),
      alt: 'Debut entrance arch with blue floral styling and red carpet',
      caption: 'Grand Entrance',
    },
    {
      src: event('debut', 'debut_design_1.jpg'),
      alt: 'Debut event centerpiece with blue draping and flamingo accents',
      caption: 'Event Styling',
    },
    {
      src: event('debut', 'debut_catering_1.jpg'),
      alt: 'Debut catering table arranged with blue event styling',
      caption: 'Catering Table',
    },
    {
      src: event('debut', 'debut_poolside_1.jpg'),
      alt: 'Woodberry poolside area for debut arrival photos',
      caption: 'Poolside Portrait Area',
    },
  ],
  weddings: [
    {
      src: event('wedding_celebration', 'wedding_celeb_main_photo_1.jpg'),
      alt: 'Better Together wedding detail sign with floral styling',
      caption: 'Wedding Detail',
    },
    {
      src: event('wedding_celebration', 'wedding_celeb_stage_1.jpg'),
      alt: 'Wedding stage with floral backdrop and couple seating',
      caption: 'Wedding Stage',
    },
    {
      src: event('wedding_celebration', 'wedding_celeb_buffet.jpg'),
      alt: 'Wedding buffet table prepared with assorted dishes',
      caption: 'Buffet Service',
    },
    {
      src: event('wedding_celebration', 'wedding_celeb_buffet_2.jpg'),
      alt: 'Wedding grazing and buffet display with floral centerpiece',
      caption: 'Reception Dining',
    },
    {
      src: event('wedding_celebration', 'wedding_celeb_drinks.jpg'),
      alt: 'Colorful wedding drinks station at Woodberry',
      caption: 'Drinks Station',
    },
    {
      src: event('wedding_celebration', 'wedding_celeb_drinks_2.jpg'),
      alt: 'Wedding beverage service with colorful drinks and garnishes',
      caption: 'Beverage Details',
    },
  ],
};

export const homepageGalleryPhotos: WoodberryGalleryPhoto[] = [
  {
    src: day('Swimming_Pool_2.jpg'),
    alt: 'Woodberry swimming pool ready for resort guests',
    caption: 'Swimming Pool',
    featured: 'tall',
  },
  {
    src: event('wedding_celebration', 'wedding_celeb_stage_1.jpg'),
    alt: 'Woodberry wedding stage with floral reception styling',
    caption: 'Wedding Stage',
  },
  {
    src: room('Room 6', 'Room 6 Main Bed.jpg'),
    alt: 'Woodberry resort room with a neatly prepared bed',
    caption: 'Resort Room',
  },
  {
    src: event('pink_birthday_party', 'pink_party_tables_1.jpg'),
    alt: "Children's party tables with pastel balloons at Woodberry",
    caption: "Children's Party",
    featured: 'wide',
  },
];

export const galleryPhotoGroups: WoodberryPhotoGroup[] = [
  {
    name: 'Resort',
    description: 'Entrances, garden views, and signature Woodberry spaces.',
    photos: [
      {
        src: night('Entrance Night.jpg'),
        alt: 'Woodberry resort entrance lit in the evening',
        caption: 'Evening Entrance',
        featured: 'wide',
      },
      {
        src: day('entrance_3.jpg'),
        alt: 'Woodberry resort entrance in daytime',
        caption: 'Resort Entrance',
      },
      {
        src: day('entrace_lights_1.jpg'),
        alt: 'Woodberry entrance walkway with decorative lights',
        caption: 'Entrance Lights',
      },
      {
        src: day('pool_and_house.jpg'),
        alt: 'Woodberry pool beside the resort house',
        caption: 'Pool and Resort House',
        featured: 'tall',
      },
      {
        src: day('tree_house.jpg'),
        alt: 'Woodberry tree house surrounded by resort greenery',
        caption: 'Tree House',
      },
      {
        src: day('bench.jpg'),
        alt: 'Woodberry garden bench seating area',
        caption: 'Garden Seating',
      },
    ],
  },
  {
    name: 'Events',
    description: "Children's parties, debuts, weddings, and hosted dining setups.",
    photos: [
      {
        src: event('pink_birthday_party', 'pink_party_stage_1.jpg'),
        alt: "Children's party stage with pastel balloon decorations",
        caption: "Children's Party Stage",
        featured: 'tall',
      },
      {
        src: event('debut', 'debut_main_stage_photo_1.jpg'),
        alt: 'Blue debut stage arranged for an eighteenth birthday',
        caption: 'Debut Stage',
      },
      {
        src: event('wedding_celebration', 'wedding_celeb_stage_1.jpg'),
        alt: 'Wedding stage with floral backdrop and couple seating',
        caption: 'Wedding Stage',
        featured: 'wide',
      },
      {
        src: event('blue_lunch', 'blue_lunch_hall_1.jpg'),
        alt: 'Blue lunch event setup with guest tables in the pavilion',
        caption: 'Lunch Gathering',
      },
      {
        src: event('wedding_celebration', 'wedding_celeb_buffet_2.jpg'),
        alt: 'Wedding buffet display with floral centerpiece',
        caption: 'Wedding Buffet',
      },
      {
        src: event('pink_birthday_party', 'pink_party_cake_2.jpg'),
        alt: "Tiered children's birthday cake display",
        caption: 'Birthday Cake',
      },
    ],
  },
  {
    name: 'Pool',
    description: 'Refreshing pool views from daytime through evening celebrations.',
    photos: [
      {
        src: day('Swimming_Pool_2.jpg'),
        alt: 'Woodberry swimming pool in clear daytime light',
        caption: 'Swimming Pool',
        featured: 'wide',
      },
      {
        src: day('Swimming_Pool_Close_Up_1.jpg'),
        alt: 'Close view of Woodberry swimming pool water',
        caption: 'Pool Close-Up',
      },
      {
        src: night('Pool Night.jpg'),
        alt: 'Woodberry swimming pool with evening lights',
        caption: 'Pool at Night',
        featured: 'tall',
      },
      {
        src: night('Pool Stage Night.jpg'),
        alt: 'Woodberry poolside stage area at dusk',
        caption: 'Poolside Stage',
      },
      {
        src: day('pool_1.jpg'),
        alt: 'Woodberry swimming pool in daytime',
        caption: 'Daytime Pool',
      },
      {
        src: day('pool_2.jpg'),
        alt: 'Woodberry pool area beside the resort pavilion',
        caption: 'Poolside Pavilion',
        featured: 'wide',
      },
    ],
  },
  {
    name: 'Rooms',
    description: 'Room interiors for simple stays and overnight visits.',
    photos: [
      {
        src: room('Room 6', 'Room 6 Main Bed.jpg'),
        alt: 'Woodberry Room 6 main bed with warm curtains',
        caption: 'Room 6 Main Bed',
        featured: 'wide',
      },
      {
        src: room('Room 6', 'Room 6 Corner Couch.jpg'),
        alt: 'Woodberry Room 6 corner couch seating',
        caption: 'Room 6 Seating',
      },
      {
        src: room('Room 5', 'Room 5 Main BEd.jpg'),
        alt: 'Woodberry Room 5 main bed',
        caption: 'Room 5 Main Bed',
      },
      {
        src: room('Room 5', 'Room 5 TV and entry.jpg'),
        alt: 'Woodberry Room 5 TV and entry area',
        caption: 'Room 5 Entry',
      },
      {
        src: room('Room 4', 'Room 4 Main Beds.jpg'),
        alt: 'Woodberry Room 4 with two prepared beds',
        caption: 'Room 4 Beds',
        featured: 'tall',
      },
      {
        src: room('Room 4', 'Room 4 Bathroom.jpg'),
        alt: 'Woodberry Room 4 bathroom',
        caption: 'Room 4 Bathroom',
      },
      {
        src: room('Room 3', 'Room 3 Main bed.jpg'),
        alt: 'Woodberry Room 3 main bed',
        caption: 'Room 3 Main Bed',
      },
      {
        src: room('Room 3', 'Room 3 TV and Cabinet.jpg'),
        alt: 'Woodberry Room 3 TV and cabinet area',
        caption: 'Room 3 TV Cabinet',
      },
      {
        src: room('Room 2', 'Room 2 Main Bed.jpg'),
        alt: 'Woodberry Room 2 main bed',
        caption: 'Room 2 Main Bed',
      },
      {
        src: room('Room 1', 'Room 1 Main Bed.jpg'),
        alt: 'Woodberry Room 1 main bed',
        caption: 'Room 1 Main Bed',
      },
    ],
  },
  {
    name: 'Pavilion',
    description: 'Covered event spaces, stages, and flexible pavilion layouts.',
    photos: [
      {
        src: day('filled_stage_1.jpg'),
        alt: 'Woodberry decorated event stage with floral details',
        caption: 'Decorated Stage',
        featured: 'wide',
      },
      {
        src: day('Empty Hall.jpg'),
        alt: 'Woodberry empty event hall ready for setup',
        caption: 'Open Event Hall',
      },
      {
        src: day('banquet_8.jpg'),
        alt: 'Woodberry pavilion hall open and ready for an event setup',
        caption: 'Open Pavilion',
      },
      {
        src: day('banquet_1.jpg'),
        alt: 'Woodberry banquet pavilion arranged for guests',
        caption: 'Banquet Pavilion',
        featured: 'tall',
      },
      {
        src: day('stage_2.jpg'),
        alt: 'Woodberry event stage prepared for a celebration',
        caption: 'Event Stage',
      },
      {
        src: day('Stage_5.jpg'),
        alt: 'Woodberry pavilion stage with event decor',
        caption: 'Pavilion Stage Decor',
      },
    ],
  },
  {
    name: 'Amenities',
    description: 'Pool access, food service areas, and guest-friendly resort details.',
    photos: [
      {
        src: day('Swimming_Pool_Close_Up_1.jpg'),
        alt: 'Close view of Woodberry swimming pool as a guest amenity',
        caption: 'Pool Access',
        featured: 'wide',
      },
      {
        src: day('stalls_1.jpg'),
        alt: 'Woodberry food stalls prepared for an event',
        caption: 'Food Stalls',
      },
      {
        src: day('buffet_1.jpg'),
        alt: 'Woodberry buffet service area',
        caption: 'Buffet Area',
      },
      {
        src: day('tables_1.jpg'),
        alt: 'Woodberry dining tables arranged for guests',
        caption: 'Guest Dining Tables',
      },
      {
        src: day('tables_2.jpg'),
        alt: 'Woodberry event tables and chairs setup',
        caption: 'Tables and Chairs',
      },
    ],
  },
];

const legacyPhotoMap = new Map<string, string>();

const addLegacy = (legacyName: string, replacement: string) => {
  legacyPhotoMap.set(`/woodberyPics/${legacyName}`.toLowerCase(), replacement);
  legacyPhotoMap.set(legacyName.toLowerCase(), replacement);
};

[
  'banquet_1.jpg',
  'banquet_2.jpg',
  'banquet_3.jpg',
  'banquet_4.jpg',
  'banquet_5.jpg',
  'banquet_6.jpg',
  'banquet_7.jpg',
  'banquet_8.jpg',
  'bench.jpg',
  'buffet_1.jpg',
  'buffet_2.jpg',
  'Empty Hall.jpg',
  'entrace_lights_1.jpg',
  'entrance_1.jpg',
  'entrance_2.jpg',
  'entrance_3.jpg',
  'filled_banquet_1.jpg',
  'filled_hall_1.jpg',
  'filled_stage_1.jpg',
  'pool_1.jpg',
  'pool_2.jpg',
  'pool_and_house.jpg',
  'Swimming_Pool_2.jpg',
  'Swimming_Pool_Close_Up_1.jpg',
  'stage_1.jpg',
  'stage_2.jpg',
  'stage_3.jpg',
  'stage_4.jpg',
  'Stage_5.jpg',
  'stalls_1.jpg',
  'tables_1.jpg',
  'tables_2.jpg',
  'tables_3.jpg',
  'tree_house.jpg',
].forEach((fileName) => addLegacy(fileName, day(fileName)));

addLegacy('afternoon_pool_1.jpg', night('Pool Night.jpg'));
addLegacy('empty_hall_1.jpg', day('Empty Hall.jpg'));
addLegacy('Entrance Night.jpg', night('Entrance Night.jpg'));
addLegacy('Pool Night.jpg', night('Pool Night.jpg'));
addLegacy('Pool Stage Night.jpg', night('Pool Stage Night.jpg'));

[
  ['blue_lunch_buffet_1.jpg', event('blue_lunch', 'blue_lunch_buffet_1.jpg')],
  ['blue_lunch_hall_1.jpg', event('blue_lunch', 'blue_lunch_hall_1.jpg')],
  ['debut_catering_1.jpg', event('debut', 'debut_catering_1.jpg')],
  ['debut_design_1.jpg', event('debut', 'debut_design_1.jpg')],
  ['debut_entrance_1.jpg', event('debut', 'debut_entrance_1.jpg')],
  ['debut_main_stage_photo_1.jpg', event('debut', 'debut_main_stage_photo_1.jpg')],
  ['debut_poolside_1.jpg', event('debut', 'debut_poolside_1.jpg')],
  ['debut_stage_1.jpg', event('debut', 'debut_stage_1.jpg')],
  ['pink_party_cake_1.jpg', event('pink_birthday_party', 'pink_party_cake_1.jpg')],
  ['pink_party_cake_2.jpg', event('pink_birthday_party', 'pink_party_cake_2.jpg')],
  ['pink_party_food_1.jpg', event('pink_birthday_party', 'pink_party_food_1.jpg')],
  ['pink_party_food_2.jpg', event('pink_birthday_party', 'pink_party_food_2.jpg')],
  ['pink_party_food_3.jpg', event('pink_birthday_party', 'pink_party_food_3.jpg')],
  ['pink_party_food_4.jpg', event('pink_birthday_party', 'pink_party_food_4.jpg')],
  ['pink_party_food_5.jpg', event('pink_birthday_party', 'pink_party_food_5.jpg')],
  ['pink_party_food_6.jpg', event('pink_birthday_party', 'pink_party_food_6.jpg')],
  ['pink_party_main_photo_1.jpg', event('pink_birthday_party', 'pink_party_main_photo_1.jpg')],
  ['pink_party_poolside_1.jpg', event('pink_birthday_party', 'pink_party_poolside_1.jpg')],
  ['pink_party_stage_1.jpg', event('pink_birthday_party', 'pink_party_stage_1.jpg')],
  ['pink_party_stage_2.jpg', event('pink_birthday_party', 'pink_party_stage_2.jpg')],
  ['pink_party_tables_1.jpg', event('pink_birthday_party', 'pink_party_tables_1.jpg')],
  ['wedding_celeb_buffet.jpg', event('wedding_celebration', 'wedding_celeb_buffet.jpg')],
  ['wedding_celeb_buffet_2.jpg', event('wedding_celebration', 'wedding_celeb_buffet_2.jpg')],
  ['wedding_celeb_drinks.jpg', event('wedding_celebration', 'wedding_celeb_drinks.jpg')],
  ['wedding_celeb_drinks_2.jpg', event('wedding_celebration', 'wedding_celeb_drinks_2.jpg')],
  ['wedding_celeb_main_photo_1.jpg', event('wedding_celebration', 'wedding_celeb_main_photo_1.jpg')],
  ['wedding_celeb_stage_1.jpg', event('wedding_celebration', 'wedding_celeb_stage_1.jpg')],
].forEach(([legacyName, replacement]) => addLegacy(legacyName, replacement));

[
  ['Room 1 Entrance.jpg', room('Room 1', 'Room 1 Entrance.jpg')],
  ['Room 1 Main Bed.jpg', room('Room 1', 'Room 1 Main Bed.jpg')],
  ['Room 2 Main Bed.jpg', room('Room 2', 'Room 2 Main Bed.jpg')],
  ['Room 3 Entrance.jpg', room('Room 3', 'Room 3 Entrance.jpg')],
  ['Room 3 Main bed.jpg', room('Room 3', 'Room 3 Main bed.jpg')],
  ['Room 3 TV and Cabinet.jpg', room('Room 3', 'Room 3 TV and Cabinet.jpg')],
  ['Room 4 Bathroom.jpg', room('Room 4', 'Room 4 Bathroom.jpg')],
  ['Room 4 Entrance.jpg', room('Room 4', 'Room 4 Entrance.jpg')],
  ['Room 4 Main Beds.jpg', room('Room 4', 'Room 4 Main Beds.jpg')],
  ['Room 4 TV and Cabinet.jpg', room('Room 4', 'Room 4 TV and Cabinet.jpg')],
  ['Room 5 Bed.jpg', room('Room 5', 'Room 5 Bed.jpg')],
  ['Room 5 Corner Cabinet.jpg', room('Room 5', 'Room 5 Corner Cabinet.jpg')],
  ['Room 5 Main BEd.jpg', room('Room 5', 'Room 5 Main BEd.jpg')],
  ['Room 5 TV and entry.jpg', room('Room 5', 'Room 5 TV and entry.jpg')],
  ['Room 6 Corner Cabinet.jpg', room('Room 6', 'Room 6 Corner Cabinet.jpg')],
  ['Room 6 Corner Couch.jpg', room('Room 6', 'Room 6 Corner Couch.jpg')],
  ['Room 6 Corner TV.jpg', room('Room 6', 'Room 6 Corner TV.jpg')],
  ['Room 6 Main Bed.jpg', room('Room 6', 'Room 6 Main Bed.jpg')],
  ['Room 6 Sink.jpg', room('Room 6', 'Room 6 Sink.jpg')],
].forEach(([legacyName, replacement]) => addLegacy(legacyName, replacement));

export const resolveWoodberryPhotoSrc = (
  src?: string | null,
  fallback: string = woodberryPhotos.fallback,
) => {
  const trimmed = src?.trim();
  if (!trimmed) return fallback;

  const [withoutHash] = trimmed.split('#');
  const [pathOnly] = withoutHash.split('?');
  const normalizedPath = pathOnly.replace(/\\/g, '/');
  const lowerPath = normalizedPath.toLowerCase();
  const basename = normalizedPath.split('/').pop()?.toLowerCase() ?? '';

  if (legacyPhotoMap.has(lowerPath)) return legacyPhotoMap.get(lowerPath) ?? fallback;
  if (legacyPhotoMap.has(basename)) return legacyPhotoMap.get(basename) ?? fallback;
  if (lowerPath.startsWith('/woodberypics/') && !lowerPath.includes('/property%20photos/')) return fallback;

  return trimmed.includes(' ') ? encodeURI(trimmed) : trimmed;
};
