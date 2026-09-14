export interface WoodberryRoomImage {
  src: string;
  alt: string;
}

export interface WoodberryRoom {
  id: string;
  name: string;
  summary: string;
  capacity: string;
  bestFor: string;
  description: string;
  features: string[];
  images: WoodberryRoomImage[];
}

export const roomImage = (roomName: string, fileName: string) =>
  `/woodbery_pics/property_photos/rooms/${encodeURIComponent(roomName)}/${encodeURIComponent(fileName)}`;

export const woodberryRooms: WoodberryRoom[] = [
  {
    id: 'room-1',
    name: 'Room 1',
    summary: 'A warm, practical room for families or small groups.',
    capacity: 'Up to 4 guests',
    bestFor: 'Simple event stays',
    description:
      'Room 1 gives guests a calm, convenient place to settle in before or after a Woodberry celebration. Its straightforward layout keeps the room easy to share while still feeling private and restful.',
    features: [
      'Prepared main bed setup',
      'Entry area for bags and quick changes',
      'Comfortable for families or small groups',
      'Close, convenient accommodation for event guests',
    ],
    images: [
      {
        src: roomImage('Room 1', 'Room 1 Main Bed.jpg'),
        alt: 'Woodberry Room 1 main bed',
      },
      {
        src: roomImage('Room 1', 'Room 1 Entrance.jpg'),
        alt: 'Woodberry Room 1 entrance area',
      },
    ],
  },
  {
    id: 'room-2',
    name: 'Room 2',
    summary: 'A comfortable private room with a quiet, restful setup.',
    capacity: 'Up to 4 guests',
    bestFor: 'Guest rest periods',
    description:
      'Room 2 is suited for guests who want a clean and comfortable retreat close to the resort activity. It is a practical choice for event participants, relatives, or visitors who need a nearby place to recharge.',
    features: [
      'Quiet private room layout',
      'Comfortable main sleeping area',
      'Simple add-on for relatives and event guests',
      'Restful space between poolside or event activities',
    ],
    images: [
      {
        src: roomImage('Room 2', 'Room 2 Main Bed.jpg'),
        alt: 'Woodberry Room 2 main bed',
      },
    ],
  },
  {
    id: 'room-3',
    name: 'Room 3',
    summary: 'A welcoming room with convenient storage and TV amenities.',
    capacity: 'Up to 4 guests',
    bestFor: 'Small families',
    description:
      'Room 3 balances comfort and function with a prepared sleeping area, entry space, and TV cabinet. It works well for guests who want an easy place to freshen up, rest, and stay close to the event.',
    features: [
      'Main bed for a comfortable stay',
      'TV and cabinet area',
      'Entry space for easy room access',
      'Flexible fit for small families or close guests',
    ],
    images: [
      {
        src: roomImage('Room 3', 'Room 3 Main bed.jpg'),
        alt: 'Woodberry Room 3 main bed',
      },
      {
        src: roomImage('Room 3', 'Room 3 TV and Cabinet.jpg'),
        alt: 'Woodberry Room 3 TV and cabinet',
      },
      {
        src: roomImage('Room 3', 'Room 3 Entrance.jpg'),
        alt: 'Woodberry Room 3 entrance area',
      },
    ],
  },
  {
    id: 'room-4',
    name: 'Room 4',
    summary: 'A spacious room option with multiple beds and bathroom access.',
    capacity: 'Up to 4 guests',
    bestFor: 'Shared stays',
    description:
      'Room 4 is a flexible accommodation choice for groups that prefer a little more sleeping space. Multiple beds, a bathroom, and room amenities make it a dependable option for longer events or overnight stays.',
    features: [
      'Multiple prepared beds',
      'Private bathroom access',
      'TV and cabinet area',
      'Well suited for shared overnight stays',
    ],
    images: [
      {
        src: roomImage('Room 4', 'Room 4 Main Beds.jpg'),
        alt: 'Woodberry Room 4 main beds',
      },
      {
        src: roomImage('Room 4', 'Room 4 Bathroom.jpg'),
        alt: 'Woodberry Room 4 bathroom',
      },
      {
        src: roomImage('Room 4', 'Room 4 TV and Cabinet.jpg'),
        alt: 'Woodberry Room 4 TV and cabinet',
      },
      {
        src: roomImage('Room 4', 'Room 4 Entrance.jpg'),
        alt: 'Woodberry Room 4 entrance area',
      },
    ],
  },
  {
    id: 'room-5',
    name: 'Room 5',
    summary: 'An intimate room for two with a tucked-away, relaxed feel.',
    capacity: 'Up to 2 guests',
    bestFor: 'Couples or VIP guests',
    description:
      'Room 5 offers a quieter accommodation option for two guests who want privacy near the resort venue. Its bed area, entry, and storage details make it comfortable for short stays tied to celebrations or staycations.',
    features: [
      'Cozy two-guest layout',
      'Main bed plus additional bed view',
      'TV and entry area',
      'Cabinet storage for short stays',
    ],
    images: [
      {
        src: roomImage('Room 5', 'Room 5 Main BEd.jpg'),
        alt: 'Woodberry Room 5 main bed',
      },
      {
        src: roomImage('Room 5', 'Room 5 Bed.jpg'),
        alt: 'Woodberry Room 5 bed',
      },
      {
        src: roomImage('Room 5', 'Room 5 TV and entry.jpg'),
        alt: 'Woodberry Room 5 TV and entry area',
      },
      {
        src: roomImage('Room 5', 'Room 5 Corner Cabinet.jpg'),
        alt: 'Woodberry Room 5 corner cabinet',
      },
    ],
  },
  {
    id: 'room-6',
    name: 'Room 6',
    summary: 'A premium two-guest room with added seating and in-room fixtures.',
    capacity: 'Up to 2 guests',
    bestFor: 'Comfort-focused stays',
    description:
      'Room 6 is the most complete room option for guests who want extra comfort during their Woodberry visit. The main bed, seating corner, TV area, cabinet, and sink create a more settled stay for couples or honored guests.',
    features: [
      'Premium main bed setup',
      'Corner couch seating',
      'TV, cabinet, and sink details',
      'Ideal for couples or honored guests',
    ],
    images: [
      {
        src: roomImage('Room 6', 'Room 6 Main Bed.jpg'),
        alt: 'Woodberry Room 6 main bed',
      },
      {
        src: roomImage('Room 6', 'Room 6 Corner Couch.jpg'),
        alt: 'Woodberry Room 6 corner couch',
      },
      {
        src: roomImage('Room 6', 'Room 6 Corner TV.jpg'),
        alt: 'Woodberry Room 6 TV corner',
      },
      {
        src: roomImage('Room 6', 'Room 6 Corner Cabinet.jpg'),
        alt: 'Woodberry Room 6 corner cabinet',
      },
      {
        src: roomImage('Room 6', 'Room 6 Sink.jpg'),
        alt: 'Woodberry Room 6 sink area',
      },
    ],
  },
];
