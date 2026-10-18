export type Branch = {
  id: string;
  address: string;
  area: string;
  route: string;
  verified: boolean;
};

export const branches: Branch[] = [
  {
    id: 'kompros',
    address: 'Комсомольский проспект, 53а',
    area: 'Свердловский район',
    route: 'https://2gis.ru/perm/firm/70000001051340508',
    verified: true,
  },
  {
    id: 'revolution',
    address: 'Улица Революции, 24',
    area: 'Свердловский район',
    route: 'https://2gis.ru/perm/firm/70000001095183975',
    verified: true,
  },
  {
    id: 'lunacharsky',
    address: 'Улица Луначарского, 99',
    area: 'Ленинский район',
    route: 'https://2gis.ru/perm/firm/70000001066083955',
    verified: true,
  },
  {
    id: 'petropavlovskaya',
    address: 'Петропавловская улица, 52',
    area: 'Ленинский район',
    route: 'https://2gis.ru/perm/firm/70000001109841158',
    verified: true,
  },
];
