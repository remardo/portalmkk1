// ============ TYPES ============
export type Role = 'operator' | 'office_head' | 'director' | 'admin';
export const RoleLabels: Record<Role, string> = {
  operator: 'Операционист',
  office_head: 'Руководитель ОО',
  director: 'Директор',
  admin: 'Администратор',
};

export interface User {
  id: number; name: string; role: Role; officeId: number; avatar: string;
  email: string; phone: string; points: number; position: string;
}

export interface Office {
  id: number; name: string; city: string; address: string; headId: number; rating: number;
}

export interface NewsItem {
  id: number; title: string; body: string; date: string; pinned: boolean; author: string;
}

export interface KBArticle {
  id: number; title: string; category: string; content: string; date: string;
}

export interface Course {
  id: number; title: string; category: string; questionsCount: number; passingScore: number;
}

export interface Attestation {
  id: number; courseId: number; userId: number; date: string; score: number; passed: boolean;
}

export interface Task {
  id: number; title: string; description: string; officeId: number; assigneeId: number;
  status: 'new' | 'in_progress' | 'done' | 'overdue';
  type: 'order' | 'checklist' | 'auto';
  priority: 'low' | 'medium' | 'high';
  dueDate: string; createdDate: string; checklistItems?: { text: string; done: boolean }[];
}

export interface Document {
  id: number; title: string; type: 'incoming' | 'outgoing' | 'internal';
  status: 'draft' | 'review' | 'approved' | 'rejected';
  author: string; date: string; officeId: number;
}

// ============ MOCK DATA ============
export const offices: Office[] = [
  { id: 1, name: 'Офис Центральный', city: 'Москва', address: 'ул. Ленина, 1', headId: 2, rating: 95 },
  { id: 2, name: 'Офис Южный', city: 'Краснодар', address: 'ул. Красная, 10', headId: 5, rating: 88 },
  { id: 3, name: 'Офис Северный', city: 'Санкт-Петербург', address: 'Невский пр., 25', headId: 8, rating: 91 },
  { id: 4, name: 'Офис Восточный', city: 'Новосибирск', address: 'ул. Кирова, 5', headId: 11, rating: 82 },
  { id: 5, name: 'Офис Западный', city: 'Калининград', address: 'ул. Мира, 15', headId: 14, rating: 78 },
  { id: 6, name: 'Офис Уральский', city: 'Екатеринбург', address: 'ул. Малышева, 36', headId: 17, rating: 85 },
  { id: 7, name: 'Офис Волжский', city: 'Казань', address: 'ул. Баумана, 44', headId: 20, rating: 90 },
  { id: 8, name: 'Офис Сибирский', city: 'Красноярск', address: 'пр. Мира, 88', headId: 23, rating: 76 },
];

const avatars = ['👤','👩','👨','👩‍💼','👨‍💼','👩‍💻','👨‍💻','👩‍🏫','👨‍🏫','👩‍⚕️'];
export const users: User[] = [
  { id: 1, name: 'Иванов Алексей', role: 'director', officeId: 1, avatar: avatars[0], email: 'ivanov@mfo.ru', phone: '+7-900-111-0001', points: 520, position: 'Генеральный директор' },
  { id: 2, name: 'Петрова Мария', role: 'office_head', officeId: 1, avatar: avatars[1], email: 'petrova@mfo.ru', phone: '+7-900-111-0002', points: 480, position: 'Руководитель ОО' },
  { id: 3, name: 'Сидоров Иван', role: 'operator', officeId: 1, avatar: avatars[2], email: 'sidorov@mfo.ru', phone: '+7-900-111-0003', points: 350, position: 'Операционист' },
  { id: 4, name: 'Козлова Анна', role: 'operator', officeId: 1, avatar: avatars[3], email: 'kozlova@mfo.ru', phone: '+7-900-111-0004', points: 410, position: 'Операционист' },
  { id: 5, name: 'Новиков Дмитрий', role: 'office_head', officeId: 2, avatar: avatars[4], email: 'novikov@mfo.ru', phone: '+7-900-222-0001', points: 390, position: 'Руководитель ОО' },
  { id: 6, name: 'Морозова Елена', role: 'operator', officeId: 2, avatar: avatars[5], email: 'morozova@mfo.ru', phone: '+7-900-222-0002', points: 310, position: 'Операционист' },
  { id: 7, name: 'Волков Артём', role: 'operator', officeId: 2, avatar: avatars[6], email: 'volkov@mfo.ru', phone: '+7-900-222-0003', points: 275, position: 'Операционист' },
  { id: 8, name: 'Лебедева Ольга', role: 'office_head', officeId: 3, avatar: avatars[7], email: 'lebedeva@mfo.ru', phone: '+7-900-333-0001', points: 445, position: 'Руководитель ОО' },
  { id: 9, name: 'Соколов Максим', role: 'operator', officeId: 3, avatar: avatars[8], email: 'sokolov@mfo.ru', phone: '+7-900-333-0002', points: 290, position: 'Операционист' },
  { id: 10, name: 'Кузнецова Дарья', role: 'operator', officeId: 3, avatar: avatars[9], email: 'kuznetsova@mfo.ru', phone: '+7-900-333-0003', points: 365, position: 'Операционист' },
  { id: 11, name: 'Попов Сергей', role: 'office_head', officeId: 4, avatar: avatars[0], email: 'popov@mfo.ru', phone: '+7-900-444-0001', points: 340, position: 'Руководитель ОО' },
  { id: 12, name: 'Васильева Наталья', role: 'operator', officeId: 4, avatar: avatars[1], email: 'vasilieva@mfo.ru', phone: '+7-900-444-0002', points: 260, position: 'Операционист' },
  { id: 13, name: 'Зайцев Павел', role: 'operator', officeId: 4, avatar: avatars[2], email: 'zaytsev@mfo.ru', phone: '+7-900-444-0003', points: 225, position: 'Операционист' },
  { id: 14, name: 'Смирнова Юлия', role: 'office_head', officeId: 5, avatar: avatars[3], email: 'smirnova@mfo.ru', phone: '+7-900-555-0001', points: 300, position: 'Руководитель ОО' },
  { id: 15, name: 'Михайлов Роман', role: 'operator', officeId: 5, avatar: avatars[4], email: 'mikhaylov@mfo.ru', phone: '+7-900-555-0002', points: 195, position: 'Операционист' },
  { id: 16, name: 'Фёдорова Ирина', role: 'operator', officeId: 5, avatar: avatars[5], email: 'fedorova@mfo.ru', phone: '+7-900-555-0003', points: 240, position: 'Операционист' },
  { id: 17, name: 'Егоров Виктор', role: 'office_head', officeId: 6, avatar: avatars[6], email: 'egorov@mfo.ru', phone: '+7-900-666-0001', points: 415, position: 'Руководитель ОО' },
  { id: 18, name: 'Тарасова Светлана', role: 'operator', officeId: 6, avatar: avatars[7], email: 'tarasova@mfo.ru', phone: '+7-900-666-0002', points: 330, position: 'Операционист' },
  { id: 19, name: 'admin', role: 'admin', officeId: 1, avatar: avatars[8], email: 'admin@mfo.ru', phone: '+7-900-000-0000', points: 999, position: 'Системный администратор' },
  { id: 20, name: 'Белов Андрей', role: 'office_head', officeId: 7, avatar: avatars[9], email: 'belov@mfo.ru', phone: '+7-900-777-0001', points: 430, position: 'Руководитель ОО' },
  { id: 21, name: 'Николаева Вера', role: 'operator', officeId: 7, avatar: avatars[0], email: 'nikolaeva@mfo.ru', phone: '+7-900-777-0002', points: 355, position: 'Операционист' },
  { id: 22, name: 'Орлов Денис', role: 'operator', officeId: 7, avatar: avatars[1], email: 'orlov@mfo.ru', phone: '+7-900-777-0003', points: 280, position: 'Операционист' },
  { id: 23, name: 'Громова Татьяна', role: 'office_head', officeId: 8, avatar: avatars[2], email: 'gromova@mfo.ru', phone: '+7-900-888-0001', points: 305, position: 'Руководитель ОО' },
  { id: 24, name: 'Степанов Кирилл', role: 'operator', officeId: 8, avatar: avatars[3], email: 'stepanov@mfo.ru', phone: '+7-900-888-0002', points: 210, position: 'Операционист' },
];

export const news: NewsItem[] = [
  { id: 1, title: 'Обновление регламента выдачи займов', body: 'С 01.02.2025 вступает в силу новый регламент выдачи микрозаймов. Всем сотрудникам необходимо ознакомиться с изменениями в базе знаний и пройти аттестацию до 15.02.2025.', date: '2025-01-20', pinned: true, author: 'Иванов Алексей' },
  { id: 2, title: 'Итоги работы за декабрь 2024', body: 'Подведены итоги работы сети за декабрь. Лучший офис — Центральный (Москва). Поздравляем коллектив! Общий объём выдач вырос на 12% по сравнению с ноябрём.', date: '2025-01-15', pinned: false, author: 'Иванов Алексей' },
  { id: 3, title: 'Новогодний график работы', body: 'Офисы работают 30 и 31 декабря до 15:00. С 1 по 8 января — выходные. С 9 января — обычный режим работы.', date: '2024-12-25', pinned: false, author: 'Петрова Мария' },
  { id: 4, title: 'Запуск нового продукта «Экспресс-займ»', body: 'С 1 марта 2025 года запускаем новый продукт — «Экспресс-займ» с упрощённой процедурой оформления. Обучающие материалы уже доступны в LMS.', date: '2025-01-25', pinned: true, author: 'Иванов Алексей' },
  { id: 5, title: 'Плановое обновление ПО', body: 'В ночь с 1 на 2 февраля будет проведено обновление серверного программного обеспечения. Возможны кратковременные перерывы в работе систем.', date: '2025-01-28', pinned: false, author: 'admin' },
];

export const kbArticles: KBArticle[] = [
  { id: 1, title: 'Процедура идентификации клиента', category: 'Регламенты', content: 'Подробная инструкция по идентификации клиента при выдаче займа. Необходимо проверить паспорт, сверить фото, проверить адрес регистрации, заполнить анкету...', date: '2025-01-10' },
  { id: 2, title: 'Работа с кассовым аппаратом', category: 'Инструкции', content: 'Пошаговая инструкция по работе с ККТ: открытие смены, проведение операций, закрытие смены, формирование Z-отчёта...', date: '2025-01-05' },
  { id: 3, title: 'Противодействие мошенничеству', category: 'Безопасность', content: 'Признаки мошеннических операций, алгоритм действий при подозрении на мошенничество, контакты службы безопасности...', date: '2024-12-20' },
  { id: 4, title: 'Стандарты обслуживания клиентов', category: 'Регламенты', content: 'Требования к внешнему виду сотрудников, скрипты приветствия и прощания, правила работы с жалобами и рекламациями...', date: '2024-12-15' },
  { id: 5, title: 'Порядок оформления «Экспресс-займа»', category: 'Продукты', content: 'Новый продукт — займ до 30 000 руб. на срок до 30 дней. Упрощённая анкета, минимальный пакет документов, решение за 15 минут...', date: '2025-01-25' },
  { id: 6, title: 'Техника безопасности в офисе', category: 'Безопасность', content: 'Правила пожарной безопасности, эвакуационные планы, расположение огнетушителей, номера экстренных служб...', date: '2024-11-10' },
];

export const courses: Course[] = [
  { id: 1, title: 'Основы микрофинансирования', category: 'Базовый', questionsCount: 20, passingScore: 80 },
  { id: 2, title: 'ПОД/ФТ (115-ФЗ)', category: 'Обязательный', questionsCount: 30, passingScore: 90 },
  { id: 3, title: 'Работа с клиентами', category: 'Soft skills', questionsCount: 15, passingScore: 70 },
  { id: 4, title: 'Новый продукт «Экспресс-займ»', category: 'Продукты', questionsCount: 10, passingScore: 85 },
  { id: 5, title: 'Информационная безопасность', category: 'Обязательный', questionsCount: 25, passingScore: 85 },
];

export const attestations: Attestation[] = [
  { id: 1, courseId: 1, userId: 3, date: '2025-01-10', score: 85, passed: true },
  { id: 2, courseId: 2, userId: 3, date: '2025-01-12', score: 92, passed: true },
  { id: 3, courseId: 1, userId: 4, date: '2025-01-11', score: 75, passed: false },
  { id: 4, courseId: 3, userId: 4, date: '2025-01-15', score: 88, passed: true },
  { id: 5, courseId: 1, userId: 6, date: '2025-01-08', score: 90, passed: true },
  { id: 6, courseId: 2, userId: 6, date: '2025-01-14', score: 65, passed: false },
  { id: 7, courseId: 1, userId: 9, date: '2025-01-09', score: 82, passed: true },
  { id: 8, courseId: 4, userId: 3, date: '2025-01-20', score: 95, passed: true },
  { id: 9, courseId: 5, userId: 4, date: '2025-01-22', score: 88, passed: true },
  { id: 10, courseId: 2, userId: 7, date: '2025-01-18', score: 93, passed: true },
  { id: 11, courseId: 3, userId: 10, date: '2025-01-19', score: 72, passed: true },
  { id: 12, courseId: 1, userId: 12, date: '2025-01-16', score: 68, passed: false },
  { id: 13, courseId: 4, userId: 6, date: '2025-01-25', score: 91, passed: true },
  { id: 14, courseId: 5, userId: 9, date: '2025-01-23', score: 78, passed: false },
  { id: 15, courseId: 1, userId: 15, date: '2025-01-17', score: 84, passed: true },
  { id: 16, courseId: 3, userId: 18, date: '2025-01-21', score: 95, passed: true },
  { id: 17, courseId: 2, userId: 21, date: '2025-01-24', score: 89, passed: false },
  { id: 18, courseId: 4, userId: 24, date: '2025-01-26', score: 87, passed: true },
];

export const tasks: Task[] = [
  { id: 1, title: 'Провести инвентаризацию бланков', description: 'Пересчитать все бланки строгой отчётности и отправить отчёт', officeId: 1, assigneeId: 3, status: 'in_progress', type: 'order', priority: 'high', dueDate: '2025-02-01', createdDate: '2025-01-20' },
  { id: 2, title: 'Ежедневный чеклист открытия офиса', description: 'Выполнить все пункты при открытии', officeId: 1, assigneeId: 4, status: 'new', type: 'checklist', priority: 'medium', dueDate: '2025-01-30', createdDate: '2025-01-30',
    checklistItems: [
      { text: 'Проверить исправность сигнализации', done: true },
      { text: 'Включить ККТ и проверить связь', done: true },
      { text: 'Проверить наличие бланков', done: false },
      { text: 'Проверить чистоту клиентской зоны', done: false },
      { text: 'Открыть кассовую смену', done: false },
    ]
  },
  { id: 3, title: 'Обновить информационный стенд', description: 'Разместить новые тарифы и условия займов', officeId: 2, assigneeId: 6, status: 'done', type: 'order', priority: 'low', dueDate: '2025-01-25', createdDate: '2025-01-15' },
  { id: 4, title: 'Пройти аттестацию по 115-ФЗ', description: 'Все сотрудники офиса должны пройти обязательную аттестацию', officeId: 2, assigneeId: 7, status: 'overdue', type: 'auto', priority: 'high', dueDate: '2025-01-20', createdDate: '2025-01-10' },
  { id: 5, title: 'Подготовить отчёт за январь', description: 'Сформировать и отправить ежемесячный отчёт по операциям', officeId: 3, assigneeId: 9, status: 'new', type: 'order', priority: 'medium', dueDate: '2025-02-05', createdDate: '2025-01-28' },
  { id: 6, title: 'Ежедневный чеклист закрытия офиса', description: 'Выполнить все пункты при закрытии', officeId: 3, assigneeId: 10, status: 'in_progress', type: 'checklist', priority: 'medium', dueDate: '2025-01-30', createdDate: '2025-01-30',
    checklistItems: [
      { text: 'Закрыть кассовую смену', done: true },
      { text: 'Сформировать Z-отчёт', done: true },
      { text: 'Убрать документы в сейф', done: false },
      { text: 'Выключить оборудование', done: false },
      { text: 'Поставить на сигнализацию', done: false },
    ]
  },
  { id: 7, title: 'Замена рекламных материалов', description: 'Установить новые баннеры продукта «Экспресс-займ»', officeId: 4, assigneeId: 12, status: 'new', type: 'order', priority: 'low', dueDate: '2025-02-10', createdDate: '2025-01-25' },
  { id: 8, title: 'Проверка пожарной безопасности', description: 'Провести проверку огнетушителей, путей эвакуации', officeId: 5, assigneeId: 15, status: 'overdue', type: 'auto', priority: 'high', dueDate: '2025-01-15', createdDate: '2025-01-05' },
  { id: 9, title: 'Обучение нового сотрудника', description: 'Провести вводный инструктаж и обучение по продуктам', officeId: 6, assigneeId: 18, status: 'in_progress', type: 'order', priority: 'medium', dueDate: '2025-02-03', createdDate: '2025-01-22' },
  { id: 10, title: 'Ежемесячная сверка кассы', description: 'Провести сверку наличных с данными системы', officeId: 7, assigneeId: 21, status: 'new', type: 'auto', priority: 'high', dueDate: '2025-02-01', createdDate: '2025-01-28' },
];

export const documents: Document[] = [
  { id: 1, title: 'Приказ №12 — Обновление тарифов', type: 'internal', status: 'approved', author: 'Иванов Алексей', date: '2025-01-20', officeId: 1 },
  { id: 2, title: 'Служебная записка — запрос канцтоваров', type: 'internal', status: 'review', author: 'Сидоров Иван', date: '2025-01-22', officeId: 1 },
  { id: 3, title: 'Акт приёма-передачи ценностей', type: 'internal', status: 'draft', author: 'Козлова Анна', date: '2025-01-25', officeId: 1 },
  { id: 4, title: 'Входящее письмо от ЦБ РФ №234', type: 'incoming', status: 'approved', author: 'Канцелярия', date: '2025-01-18', officeId: 1 },
  { id: 5, title: 'Ответ на запрос ЦБ РФ', type: 'outgoing', status: 'review', author: 'Петрова Мария', date: '2025-01-23', officeId: 1 },
  { id: 6, title: 'Заявление на отпуск', type: 'internal', status: 'approved', author: 'Морозова Елена', date: '2025-01-15', officeId: 2 },
  { id: 7, title: 'Акт инвентаризации', type: 'internal', status: 'draft', author: 'Новиков Дмитрий', date: '2025-01-27', officeId: 2 },
  { id: 8, title: 'Отчёт по продажам за январь', type: 'outgoing', status: 'review', author: 'Лебедева Ольга', date: '2025-01-29', officeId: 3 },
  { id: 9, title: 'Приказ о назначении ответственного', type: 'internal', status: 'approved', author: 'Попов Сергей', date: '2025-01-12', officeId: 4 },
  { id: 10, title: 'Договор аренды — продление', type: 'outgoing', status: 'rejected', author: 'Смирнова Юлия', date: '2025-01-20', officeId: 5 },
];
