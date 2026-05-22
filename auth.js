const jwt = require('jsonwebtoken');

require('dotenv').config();

/*
========================================
DUMMY USERS
========================================
*/

const users = [
    {
        username: 'admin',
        password: 'admin123',
        role: 'admin'
    },
    {
        username: 'viewer',
        password: 'viewer123',
        role: 'viewer'
    }
];

/*
========================================
LOGIN FUNCTION
========================================
*/

const login = (req, res) => {

    const { username, password } = req.body;

    const user = users.find(
        u =>
            u.username === username &&
            u.password === password
    );

    if (!user) {

        return res.status(401).json({
            error: 'Invalid credentials'
        });
    }

    /*
    GENERATE JWT TOKEN
    */

    const token = jwt.sign(
        {
            username: user.username,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '1h'
        }
    );

    res.json({
        message: 'Login successful',
        token,
        role: user.role
    });
};

module.exports = {
    login
};