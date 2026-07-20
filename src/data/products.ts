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
    description: 'Чистая геометрия теста, масла и жара. Точка отсчёта всей витрины.',
    price: '210 ₽',
    crop: '0% 0%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'almond-croissant',
    name: 'Круассан миндальный',
    type: 'Круассан с начинкой',
    description: 'Плотная миндальная начинка, лепестки и пудра поверх хрустящих слоёв.',
    price: '390 ₽',
    crop: '-33.333% 0%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'pistachio-snail',
    name: 'Пан шоколя',
    type: 'Слойка',
    description: 'Слоёный прямоугольник с шоколадом — короткий и убедительный ответ к кофе.',
    price: '330 ₽',
    crop: '-66.666% 0%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'pistachio-snail',
    name: 'Фисташковая улитка',
    type: 'Слойка',
    description: 'Спираль слоёного теста с фисташкой — видно сразу, за что выбирать.',
    price: '330 ₽',
    crop: '0% -50%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'chocolate-cruffin',
    name: 'Шоколадный краффин',
    type: 'Выпечка',
    description: 'Высокая спираль, шоколад и много хрустящих кромок.',
    price: '360 ₽',
    crop: '-33.333% -50%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'berry-tart',
    name: 'Тарталетка ягодная',
    type: 'Десерт',
    description: 'Хрустящая основа, крем и свежий ягодный акцент.',
    price: '410 ₽',
    crop: '-66.666% -50%',
    source: publicMenu,
    demoVisual: true,
  },
];
