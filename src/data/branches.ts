export type Branch = {
  id: string;
  address: string;
  area: string;
  hours: string;
  feature: string;
  route: string;
  position: { x: number; y: number };
  verified: boolean;
};

export const branches: Branch[] = [
  {
    id: 'kompros',
    address: 'Комсомольский проспект, 53а',
    area: 'Свердловский район',
    hours: '08:00–22:00',
    feature: 'Въезд с Комсомольского проспекта',
    route: 'https://2gis.ru/perm/firm/70000001051340508',
    position: { x: 38, y: 73 },
    verified: true,
  },
  {
    id: 'revolution',
    address: 'Улица Революции, 24',
    area: 'Свердловский район',
    hours: 'Уточнить в 2ГИС',
    feature: 'Рядом с магазином «Лион»',
    route: 'https://2gis.ru/perm/firm/70000001095183975',
    position: { x: 53, y: 59 },
    verified: true,
  },
  {
    id: 'lunacharsky',
    address: 'Улица Луначарского, 99',
    area: 'Ленинский район',
    hours: '08:00–22:00',
    feature: 'Вход с улицы Борчанинова',
    route: 'https://2gis.ru/perm/firm/70000001066083955',
    position: { x: 30, y: 40 },
    verified: true,
  },
  {
    id: 'petropavlovskaya',
    address: 'Петропавловская улица, 52',
    area: 'Ленинский район',
    hours: 'Уточнить в 2ГИС',
    feature: 'Первый этаж',
    route: 'https://2gis.ru/perm/firm/70000001109841158',
    position: { x: 57, y: 31 },
    verified: true,
  },
];
