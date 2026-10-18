export type Product = {
  id: string;
  name: string;
  type: string;
  description: string;
  price: string;
  crop: string;
  source: string;
  demoVisual: boolean;
};

const publicMenu = 'https://2gis.ru/perm/firm/70000001066083955/tab/prices';

export const products: Product[] = [
  {
    id: 'classic-croissant',
    name: 'Круассан классический',
    type: 'Круассан',
    description: 'Золотистая корочка и тонкие слои.',
    price: '210 ₽',
    crop: '-3.90625% 0%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'almond-croissant',
    name: 'Круассан миндальный',
    type: 'Круассан с начинкой',
    description: 'Миндальные лепестки и сахарная пудра.',
    price: '390 ₽',
    crop: '-36.45833% 0%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'pain-au-chocolat',
    name: 'Пан шоколя',
    type: 'Слойка',
    description: 'Шоколад и слоёная корочка.',
    price: '330 ₽',
    crop: '-67.44792% 0%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'pistachio-snail',
    name: 'Фисташковая улитка',
    type: 'Слойка',
    description: 'Слоёная спираль с фисташкой.',
    price: '330 ₽',
    crop: '-1.30208% -48.4375%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'chocolate-cruffin',
    name: 'Шоколадный краффин',
    type: 'Выпечка',
    description: 'Слоёная выпечка с шоколадом.',
    price: '360 ₽',
    crop: '-34.50521% -48.4375%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'berry-tart',
    name: 'Тарталетка ягодная',
    type: 'Десерт',
    description: 'Небольшая тарталетка с ягодами.',
    price: '410 ₽',
    crop: '-67.44792% -48.4375%',
    source: publicMenu,
    demoVisual: true,
  },
];
