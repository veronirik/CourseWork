const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const session = require('express-session');
const express = require('express');
const exphbs = require('express-handlebars');
const bcrypt = require('bcrypt');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const { engine } = require('express-handlebars');
const bodyParser = require('body-parser');
const Handlebars = require('handlebars');
const app = express();
const port = 1234;

(async () => {
    // open the database
    const db = await open({
      filename: './db/database.db',
      driver: sqlite3.Database
    });

app.use(session({
    secret: 'qwe',
    resave: false,
    saveUninitialized: true
}));

// //Хеширование пароля перед сохранением
// const adminLogin = 'admin';
// const adminPassword = 'password';
// // Хеширование пароля перед сохранением
// bcrypt.hash(adminPassword, 10, async (err, hashedPassword) => {
//     if (err) {
//         console.error(err);
//         return;
//     }

//     // Вывод хэша в консоль
//     console.log('Hashed password:', hashedPassword);
//     try{
//         await db.run('INSERT into admin (login, password) VALUES (?, ?)', adminLogin, hashedPassword);
//     } catch (err) {
//         console.error(err.message);
//     }
// });

// Установка статической папки для CSS и JS файлов
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Настройка Handlebars
app.engine('handlebars', engine({
    defaultLayout: 'main', // задаем основной макет
    layoutsDir: path.join(__dirname, 'views/layouts')
  }));
  app.set('view engine', 'handlebars');
  app.set('views', path.join(__dirname, 'views'));

// Подключение body-parser для обработки POST-запросов
app.use(bodyParser.urlencoded({ extended: true }));

//Роут для перехода на страницу информации об Эфиопии
app.get('/ephiopia_info', async (req, res) => {
    res.render('ephiopia_info');
});

//Роут для перехода на страницу информации об Гватемале
app.get('/guatemala_info', async (req, res) => {
    res.render('guatemala_info');
});

//Роут для перехода на страницу информации о Мексике
app.get('/mexico_info', async (req, res) => {
    res.render('mexico_info');
});

//Роут для перехода в корзину
app.get('/cart', async(req, res) => {
    res.render('cart');
})

//Маршрут для сохранения заказов в таблицы баз данных
app.post('/cart-handler', async (req, res) => {
    const { cart, name, phone, email } = req.body;

    try {
        order = await db.run('INSERT INTO orders (name, phone, email) VALUES (?, ?, ?)', [name, phone, email]);
        const orderId = order.lastID
        
        for (let item of cart) {
            await db.run(
                'INSERT INTO order_items (order_id, product_id, title, cost) VALUES (?, ?, ?, ?)', 
                [orderId, item.id, item.title, item.cost]
            );
        }

        res.status(200).send()
      } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка сервера');
      }
});

//Маршрут просмотра заказов
app.get('/admin/view_orders', checkAuth, async(req, res) => {
    const getOrdersQuery = `
    SELECT
    orders.id,
    orders.name,
    orders.phone,
    orders.email,
    GROUP_CONCAT(order_items.title, ', ') AS products,
    SUM(order_items.cost) AS total_cost
FROM
    orders
JOIN
    order_items ON orders.id = order_items.order_id
GROUP BY
    orders.id`;

    try {
        const rows = await db.all(getOrdersQuery, [])
        console.log(rows)
        res.render('view_orders', { orders: rows })
    } catch(err) {
        console.error(err.message);
        res.status(500).send('internal server error');
        return;
    }
});

// //Маршрут добавления новости
app.post('/admin/add_coffee', checkAuth, async (req, res) => {
    const { title, content, country, cost, method_processing, roast_degree, img_catalog } = req.body;
    try {
      await db.run('INSERT INTO coffee (title, content, country, cost, method_processing, roast_degree, img_catalog) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [title, content, country, cost, method_processing, roast_degree, img_catalog]);
        res.redirect('/admin/view_catalog');
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Ошибка сервера');
    }
  });


//Маршрут для удаления карточки новости

app.post('/admin/delete_coffee', checkAuth, async (req, res) => {
    const { id } = req.body;
    try {
      await db.run('DELETE FROM coffee WHERE id = ?', id);
      res.redirect('/admin/view_catalog');
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Ошибка сервера');
    }
  });
  
//Маршрут просмотра заявок
app.get('/admin/view_request', checkAuth, async(req, res) => {
    const getVisitorsQuery = `
    SELECT id, visitor_email, visitor_name, visitor_message
    FROM Visitors`;

    try {
        const rows = await db.all(getVisitorsQuery, [])
        res.render('view_request', { requests: rows })
    } catch(err) {
        console.error(err.message);
        res.status(500).send('internal server error');
        return;
    }
})

//Маршрут для показа каталога кофе
app.get('/admin/view_catalog', checkAuth, async (req, res) => {
    const getCoffeeQuery = `
        SELECT id, title, content, country, cost, method_processing, roast_degree, img_catalog
        FROM coffee
    `;

    try {
        const rows = await db.all(getCoffeeQuery, [])
        res.render('view_catalog', { coffee: rows })
    } catch(err) {
        console.error(err.message);
        res.status(500).send('internal server error');
        return;
    }
});

//Роут главной страницы
app.get('/', async (req, res) => {
    const db_coffee = await db.all('SELECT * FROM coffee');
    res.render('index', { coffee : db_coffee });
});

// Хелпер для показа карусели
Handlebars.registerHelper('group', function(items, groupSize) {
    let groupedItems = [];
    for (let i = 0; i < items.length; i += groupSize) {
        groupedItems.push(items.slice(i, i + groupSize));
    }
    return groupedItems;
});

//Роут в каталог кофе
app.get('/coffee_catalog', async (req, res) => {
    try {
        const { country, method_processing, roast_degree, cost } = req.query;
        let query = "SELECT * FROM coffee WHERE 1=1";
        const params = [];

        if (country && country !== 'all') {
            query += " AND country = ?";
            params.push(country);
        }
        if (method_processing && method_processing !== 'all') {
            query += " AND method_processing = ?";
            params.push(method_processing);
        }
        if (roast_degree && roast_degree !== 'all') {
            query += " AND roast_degree = ?";
            params.push(roast_degree);
        }
        if (cost && cost !== 'all') {
            if (cost === '1000') {
                query += " AND cost <= ?";
                params.push(1000);
            } else if (cost === '2000') {
                query += " AND cost BETWEEN ? AND ?";
                params.push(1001, 2000);
            } else if (cost === '3000') {
                query += " AND cost BETWEEN ? AND ?";
                params.push(2001, 3000);
            } else if (cost === '3001') {
                query += " AND cost >= ?";
                params.push(3001);
            }
        }

        const coffeeList = await db.all(query, params);

        const countries = (await db.all('SELECT DISTINCT country FROM coffee')).map(option => ({
            country: option.country,
            isSelected: option.country === country
        }));

        const method_processings = (await db.all('SELECT DISTINCT method_processing FROM coffee')).map(option => ({
            method_processing: option.method_processing,
            isSelected: option.method_processing === method_processing
        }));

        const roasts = (await db.all('SELECT DISTINCT roast_degree FROM coffee')).map(option => ({
            roast_degree: option.roast_degree,
            isSelected: option.roast_degree === roast_degree
        }));

        const priceOptions = [
            { value: '1000', label: 'до 1к руб.', isSelected: cost === '1000' },
            { value: '2000', label: '1к-2к руб.', isSelected: cost === '2000' },
            { value: '3000', label: '2к-3к руб.', isSelected: cost === '3000' },
            { value: '3001', label: '3к+ руб.', isSelected: cost === '3001' }
        ];

        res.render('coffee_catalog', {
            coffeeList,
            countries,
            method_processings,
            roasts,
            priceOptions
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка сервера');
    }
});



//Обработка post-запроса с формы обращением
app.post('/submit-form', async (req, res) => {
    const { visitor_email, visitor_name, visitor_message } = req.body;
    console.log(req.body);
    try {
      const stmt = await db.prepare("INSERT INTO Visitors (visitor_email, visitor_name, visitor_message) VALUES (?, ?, ?)");
      await stmt.run(visitor_email, visitor_name, visitor_message);
      await stmt.finalize();
      res.redirect('/');
    } catch (err) {
      console.error(err);
      res.status(500).send('Ошибка при сохранении данных.');
    }
});


//Работа с админкой

//Функция проверки аутентификации администратора
function checkAuth(req, res, next) {
    if (req.session.adminId) {
      return next();
    }
    res.redirect('/admin/login');
}

app.get('/admin/login', (req, res) => {
    res.render('login');
  });

//Обработка формы входа
app.post('/admin-login', async (req, res) => {
    const { login, password } = req.body;
    console.log(login, '|' ,password);
    try {
      const admin = await db.get('SELECT * FROM admin WHERE login = ?', [login]);
      if (admin && await bcrypt.compare(password, admin.password)) {
        req.session.adminId = admin.id;
        return res.redirect('admin');
      }
      res.render('login', { error: 'Неправильный логин или пароль' });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Ошибка сервера');
    }
  });

// Маршрут для админ-панели
app.get('/admin', checkAuth, async (req, res) => {
    try {
      const admin = await db.all('SELECT * FROM admin');
      res.render('admin', { admin });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Ошибка сервера');
    }
  });


app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});

})()