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
    description: 'Золотистая классика из публичного меню. Визуал — демонстрационный.',
    price: 'Смотреть в меню',
    crop: '10% 15%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'almond-croissant',
    name: 'Круассан миндальный',
    type: 'Круассан с начинкой',
    description: 'Позиция подтверждена публичным меню; состав и цена могут меняться.',
    price: 'Смотреть в меню',
    crop: '50% 15%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'pistachio-snail',
    name: 'Фисташковая улитка',
    type: 'Слойка',
    description: 'Слоёная позиция из публичного меню. Фото не является изображением блюда.',
    price: 'Смотреть в меню',
    crop: '90% 15%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'san-sebastian',
    name: 'Чизкейк Сан-Себастьян',
    type: 'Десерт',
    description: 'Десерт из публичного меню; актуальные детали доступны по ссылке.',
    price: 'Смотреть в меню',
    crop: '50% 85%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'bread',
    name: 'Хлеб с витрины',
    type: 'Хлеб',
    description: 'Демонстрационная категория. Наличие уточняйте в актуальном меню.',
    price: 'Уточнить наличие',
    crop: '12% 82%',
    source: publicMenu,
    demoVisual: true,
  },
  {
    id: 'seasonal',
    name: 'Сезонная позиция',
    type: 'Сегодня из печи',
    description: 'Нейтральный placeholder для позиции, которая меняется вместе с сезоном.',
    price: 'Смотреть новинки',
    crop: '88% 82%',
    source: 'https://vk.com/cehperm',
    demoVisual: true,
  },
];
