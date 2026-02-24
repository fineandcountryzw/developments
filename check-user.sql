SELECT id, email, name, role, is_active, password IS NOT NULL as has_password FROM users LIMIT 5;
