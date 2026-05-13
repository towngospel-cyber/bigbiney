import React, { useState } from 'react';

const PrintingPressSystem = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [showLoginForm, setShowLoginForm] = useState(true);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState(''); // FIX 6: login error state

  const accounts = [
    { id: 1, email: 'admin@printshop.com', password: 'admin123', name: 'Admin User' },
    { id: 2, email: 'user@printshop.com', password: 'user123', name: 'Standard User' },
  ];

  const historicalSales = [
    { id: 's1', date: '2026-05-11', amount: 1350 },
    { id: 's2', date: '2026-05-09', amount: 2000 },
    { id: 's3', date: '2026-05-08', amount: 1950 },
    { id: 's4', date: '2026-05-07', amount: 2460 },
    { id: 's5', date: '2026-05-06', amount: 700 },
    { id: 's6', date: '2026-05-05', amount: 1450 },
    { id: 's7', date: '2026-05-04', amount: 1930 },
    { id: 's8', date: '2026-05-02', amount: 1000 },
    { id: 's9', date: '2026-05-01', amount: 2360 },
    { id: 's10', date: '2026-04-30', amount: 2462 },
  ];

  const historicalExpenses = [
    { id: 'e1', date: '2026-05-11', category: 'Other', description: 'tshirt', amount: 600 },
    { id: 'e2', date: '2026-05-09', category: 'Other', description: 'supplies', amount: 950 },
    { id: 'e3', date: '2026-05-08', category: 'Paper', description: 'paper stock', amount: 1300 },
    { id: 'e4', date: '2026-05-02', category: 'Other', description: 'T-shirt', amount: 850 },
    { id: 'e5', date: '2026-05-02', category: 'Other', description: 'Flexy', amount: 650 },
  ];

  const [sales, setSales] = useState(historicalSales);
  const [expenses, setExpenses] = useState(historicalExpenses);
  const [todos, setTodos] = useState([
    { id: 1, text: 'Refill ink cartridges', completed: false, priority: 'high' },
    { id: 2, text: 'Check Press efficiency', completed: true, priority: 'medium' },
    { id: 3, text: 'Order paper stock', completed: false, priority: 'high' },
  ]);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'success', message: 'Payment received from TechStart Inc', read: false },
    { id: 2, type: 'warning', message: 'Low ink level detected', read: false },
  ]);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [todoInput, setTodoInput] = useState('');
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [salesFormData, setSalesFormData] = useState({ date: '', amount: '' });
  const [expenseFormData, setExpenseFormData] = useState({ date: '', category: 'Paper', description: '', amount: '' });

  const handleLogin = () => {
    const user = accounts.find(a => a.email === loginData.email && a.password === loginData.password);
    if (user) {
      setCurrentUser(user);
      setLoginData({ email: '', password: '' });
      setLoginError(''); // FIX 6: clear error on success
      setShowLoginForm(false);
    } else {
      setLoginError('Invalid email or password. Please try again.'); // FIX 6: show error
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowLoginForm(true);
    setLoginError('');
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getMonthlyStats = () => {
    const currentMonth = getCurrentMonth();
    const monthlySales = sales.filter(s => s.date.startsWith(currentMonth));
    const monthlyExpenses = expenses.filter(e => e.date.startsWith(currentMonth));

    return {
      monthlySales: monthlySales.reduce((sum, s) => sum + s.amount, 0),
      monthlyExpenses: monthlyExpenses.reduce((sum, e) => sum + e.amount, 0),
      totalSales: sales.reduce((sum, s) => sum + s.amount, 0),
      totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
    };
  };

  const handlePrint = () => {
    const stats = getMonthlyStats();
    const printWindow = window.open('', '', 'width=900,height=600');
    const html = `
      <html>
      <head><title>Print Shop Manager - Financial Report</title></head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1>PRINT SHOP MANAGER - FINANCIAL REPORT</h1>
        <p style="color: #666;">Generated: ${new Date().toLocaleString()}</p>
        
        <h2>MONTHLY STATISTICS (${getCurrentMonth()})</h2>
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <tr style="background: #f0f0f0;">
            <td style="padding: 10px; border: 1px solid #ddd;">Monthly Income</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: green;">GH₵${stats.monthlySales.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Monthly Expenses</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: red;">GH₵${stats.monthlyExpenses.toLocaleString()}</td>
          </tr>
          <tr style="background: #f0f0f0;">
            <td style="padding: 10px; border: 1px solid #ddd;">Monthly Profit</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: blue;">GH₵${(stats.monthlySales - stats.monthlyExpenses).toLocaleString()}</td>
          </tr>
        </table>

        <h2>ALL-TIME STATISTICS</h2>
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <tr style="background: #f0f0f0;">
            <td style="padding: 10px; border: 1px solid #ddd;">Total Income</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: green;">GH₵${stats.totalSales.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Total Expenses</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: red;">GH₵${stats.totalExpenses.toLocaleString()}</td>
          </tr>
          <tr style="background: #f0f0f0;">
            <td style="padding: 10px; border: 1px solid #ddd;">Net Profit</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: blue;">GH₵${(stats.totalSales - stats.totalExpenses).toLocaleString()}</td>
          </tr>
        </table>

        <h2>TASKS SUMMARY</h2>
        <p>Total Tasks: ${todos.length}</p>
        <p>Completed: ${todos.filter(t => t.completed).length}</p>
        <p>Pending: ${todos.filter(t => !t.completed).length}</p>

        <p style="margin-top: 40px; color: #999; font-size: 12px;">Print Shop Manager - Generated ${new Date().toLocaleString()}</p>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const exportData = () => {
    const stats = getMonthlyStats();
    const data = {
      exportDate: new Date().toISOString(),
      user: currentUser?.name,
      monthlyStats: {
        monthlySales: stats.monthlySales,
        monthlyExpenses: stats.monthlyExpenses,
        monthlyProfit: stats.monthlySales - stats.monthlyExpenses,
      },
      allTimeStats: {
        totalSales: stats.totalSales,
        totalExpenses: stats.totalExpenses,
        netProfit: stats.totalSales - stats.totalExpenses,
      },
      sales,
      expenses,
      todos,
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `print_shop_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addTodo = () => {
    if (todoInput.trim()) {
      setTodos([...todos, { id: Date.now(), text: todoInput, completed: false, priority: 'medium' }]);
      setTodoInput('');
      setShowTodoForm(false);
      setNotifications([{ id: Date.now(), type: 'success', message: 'Task added!', read: false }, ...notifications]);
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  const addSale = () => {
    if (salesFormData.date && salesFormData.amount) {
      // FIX 1: use unique id instead of array index for deletion
      setSales([...sales, { id: `s${Date.now()}`, date: salesFormData.date, amount: parseFloat(salesFormData.amount) }]);
      setSalesFormData({ date: '', amount: '' });
      setShowSalesForm(false);
      setNotifications([{ id: Date.now(), type: 'success', message: `Sale of GH₵${salesFormData.amount} recorded`, read: false }, ...notifications]);
    }
  };

  const addExpense = () => {
    if (expenseFormData.date && expenseFormData.amount) {
      // FIX 2: use unique id instead of array index for deletion
      setExpenses([...expenses, { id: `e${Date.now()}`, date: expenseFormData.date, category: expenseFormData.category, description: expenseFormData.description, amount: parseFloat(expenseFormData.amount) }]);
      setExpenseFormData({ date: '', category: 'Paper', description: '', amount: '' });
      setShowExpenseForm(false);
      setNotifications([{ id: Date.now(), type: 'info', message: `Expense of GH₵${expenseFormData.amount} recorded`, read: false }, ...notifications]);
    }
  };

  const stats = getMonthlyStats();

  if (showLoginForm) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>🖨️ Print Shop Manager</h1>
          <p style={styles.loginSubtitle}>Financial Management System</p>

          <div style={styles.loginForm}>
            <input
              type="email"
              placeholder="Email"
              value={loginData.email}
              onChange={e => { setLoginData({ ...loginData, email: e.target.value }); setLoginError(''); }}
              style={styles.input}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} // FIX 4: onKeyDown
            />
            <input
              type="password"
              placeholder="Password"
              value={loginData.password}
              onChange={e => { setLoginData({ ...loginData, password: e.target.value }); setLoginError(''); }}
              style={styles.input}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} // FIX 4: onKeyDown
            />
            {/* FIX 6: show login error */}
            {loginError && (
              <p style={styles.errorText}>{loginError}</p>
            )}
            <button onClick={handleLogin} style={styles.btnPrimary}>Sign In</button>
          </div>

          <div style={styles.demoSection}>
            <p style={styles.demoTitle}>Demo Accounts:</p>
            <button onClick={() => { setLoginData({ email: 'admin@printshop.com', password: 'admin123' }); setLoginError(''); }} style={styles.demoBtn}>Admin</button>
            <button onClick={() => { setLoginData({ email: 'user@printshop.com', password: 'user123' }); setLoginError(''); }} style={styles.demoBtn}>User</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>🖨️ PRINT SHOP MANAGER</h1>
          <p style={styles.headerSubtitle}>Financial Management & Task Tracking</p>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.notificationBell}>
            <button onClick={() => setShowNotifications(!showNotifications)} style={styles.bellBtn}>
              🔔
              {notifications.filter(n => !n.read).length > 0 && (
                <span style={styles.badge}>{notifications.filter(n => !n.read).length}</span>
              )}
            </button>

            {showNotifications && (
              <div style={styles.notifPanel}>
                <h3>Notifications</h3>
                {notifications.map(notif => (
                  <div key={notif.id} style={styles.notifItem}>
                    <p>{notif.message}</p>
                    <button onClick={() => setNotifications(notifications.filter(n => n.id !== notif.id))} style={styles.closeBtn}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.userInfo}>
            👤 {currentUser?.name}
          </div>
          <button onClick={handleLogout} style={styles.btnSecondary}>Logout</button>
        </div>
      </header>

      <div style={styles.navTabs}>
        {['dashboard', 'sales', 'expenses', 'todos'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ ...styles.navTab, ...(activeTab === tab ? styles.navTabActive : {}) }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeTab === 'dashboard' && (
          <div>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>GH₵{stats.monthlySales.toLocaleString()}</div>
                <div style={styles.statLabel}>Monthly Income</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>GH₵{stats.monthlyExpenses.toLocaleString()}</div>
                <div style={styles.statLabel}>Monthly Expenses</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>GH₵{(stats.monthlySales - stats.monthlyExpenses).toLocaleString()}</div>
                <div style={styles.statLabel}>Monthly Profit</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{todos.filter(t => !t.completed).length}</div>
                <div style={styles.statLabel}>Pending Tasks</div>
              </div>
            </div>

            <div style={styles.actionButtons}>
              <button onClick={handlePrint} style={styles.actionBtn}>🖨️ Print Report</button>
              <button onClick={exportData} style={styles.actionBtn}>📥 Export Data</button>
              {/* FIX 5: navigate to todos tab instead of toggling form from dashboard */}
              <button onClick={() => { setActiveTab('todos'); setShowTodoForm(true); }} style={styles.actionBtn}>➕ Add Task</button>
            </div>

            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Pending Tasks</h2>
              {todos.filter(t => !t.completed).map(todo => (
                <div key={todo.id} style={styles.todoItem}>
                  {/* FIX 3: controlled checkbox with checked prop */}
                  <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo.id)} />
                  <span>{todo.text}</span>
                  <button onClick={() => deleteTodo(todo.id)} style={styles.deleteBtn}>×</button>
                </div>
              ))}
            </div>

            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Recent Alerts</h2>
              {notifications.slice(0, 3).map(notif => (
                <div key={notif.id} style={styles.alertItem}>
                  <span>{notif.type === 'success' ? '✅' : '⚠️'} {notif.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div>
            <button onClick={() => setShowSalesForm(!showSalesForm)} style={styles.btnPrimary}>+ Record Sale</button>
            {showSalesForm && (
              <div style={styles.formContainer}>
                <input type="date" value={salesFormData.date} onChange={e => setSalesFormData({ ...salesFormData, date: e.target.value })} style={styles.input} />
                <input type="number" placeholder="Amount (GH₵)" value={salesFormData.amount} onChange={e => setSalesFormData({ ...salesFormData, amount: e.target.value })} style={styles.input} />
                <button onClick={addSale} style={styles.btnPrimary}>Record Sale</button>
              </div>
            )}
            <div style={styles.table}>
              {/* FIX 1: sort a copy, delete by unique id not array index */}
              {[...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).map((sale) => (
                <div key={sale.id} style={styles.tableRow}>
                  <span>{new Date(sale.date).toLocaleDateString()}</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>GH₵{sale.amount.toLocaleString()}</span>
                  <button onClick={() => setSales(sales.filter(s => s.id !== sale.id))} style={styles.deleteBtn}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div>
            <button onClick={() => setShowExpenseForm(!showExpenseForm)} style={styles.btnPrimary}>+ Add Expense</button>
            {showExpenseForm && (
              <div style={styles.formContainer}>
                <input type="date" value={expenseFormData.date} onChange={e => setExpenseFormData({ ...expenseFormData, date: e.target.value })} style={styles.input} />
                <select value={expenseFormData.category} onChange={e => setExpenseFormData({ ...expenseFormData, category: e.target.value })} style={styles.input}>
                  <option>Paper</option>
                  <option>Ink & Toner</option>
                  <option>Maintenance</option>
                  <option>Salaries</option>
                  <option>Other</option>
                </select>
                <input type="text" placeholder="Description" value={expenseFormData.description} onChange={e => setExpenseFormData({ ...expenseFormData, description: e.target.value })} style={styles.input} />
                <input type="number" placeholder="Amount (GH₵)" value={expenseFormData.amount} onChange={e => setExpenseFormData({ ...expenseFormData, amount: e.target.value })} style={styles.input} />
                <button onClick={addExpense} style={styles.btnPrimary}>Record Expense</button>
              </div>
            )}
            <div style={styles.table}>
              {/* FIX 2: sort a copy, delete by unique id not array index */}
              {[...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).map((exp) => (
                <div key={exp.id} style={styles.tableRow}>
                  <span>{new Date(exp.date).toLocaleDateString()}</span>
                  <span>{exp.category}</span>
                  <span>{exp.description}</span>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>GH₵{exp.amount.toLocaleString()}</span>
                  <button onClick={() => setExpenses(expenses.filter(e => e.id !== exp.id))} style={styles.deleteBtn}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'todos' && (
          <div>
            <button onClick={() => setShowTodoForm(!showTodoForm)} style={styles.btnPrimary}>+ Add Task</button>
            {showTodoForm && (
              <div style={styles.formContainer}>
                <input
                  type="text"
                  placeholder="Task description..."
                  value={todoInput}
                  onChange={e => setTodoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTodo()} // FIX 4: onKeyDown
                  style={styles.input}
                />
                <button onClick={addTodo} style={styles.btnPrimary}>Add Task</button>
              </div>
            )}
            <div>
              <h3 style={styles.sectionTitle}>Pending Tasks</h3>
              {todos.filter(t => !t.completed).map(todo => (
                <div key={todo.id} style={styles.todoItem}>
                  {/* FIX 3: controlled checkbox */}
                  <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo.id)} />
                  <span>{todo.text}</span>
                  <button onClick={() => deleteTodo(todo.id)} style={styles.deleteBtn}>×</button>
                </div>
              ))}
            </div>
            <div>
              <h3 style={styles.sectionTitle}>Completed Tasks</h3>
              {todos.filter(t => t.completed).map(todo => (
                <div key={todo.id} style={{ ...styles.todoItem, opacity: 0.6 }}>
                  {/* FIX 3: controlled checkbox */}
                  <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo.id)} />
                  <span style={{ textDecoration: 'line-through' }}>{todo.text}</span>
                  <button onClick={() => deleteTodo(todo.id)} style={styles.deleteBtn}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  appContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  loginContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  loginCard: {
    background: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    width: '100%',
    maxWidth: '400px',
  },
  loginTitle: {
    fontSize: '32px',
    marginBottom: '8px',
    color: '#333',
  },
  loginSubtitle: {
    color: '#999',
    fontSize: '14px',
    marginBottom: '30px',
  },
  loginForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '30px',
  },
  errorText: {
    color: '#ef4444',
    fontSize: '13px',
    margin: '0',
    padding: '8px 12px',
    background: '#fef2f2',
    borderRadius: '4px',
    border: '1px solid #fecaca',
  },
  header: {
    background: 'white',
    borderBottom: '2px solid #667eea',
    padding: '20px 30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '4px',
  },
  headerSubtitle: {
    fontSize: '12px',
    color: '#999',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  notificationBell: {
    position: 'relative',
  },
  bellBtn: {
    background: '#f0f0f0',
    border: '1px solid #ddd',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '18px',
  },
  badge: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    background: '#ef4444',
    color: 'white',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  notifPanel: {
    position: 'absolute',
    top: '100%',
    right: 0,
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
    width: '300px',
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '15px',
    marginTop: '10px',
    zIndex: 1000,
  },
  notifItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    background: '#f9f9f9',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '13px',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    color: '#999',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#f5f5f5',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '500',
  },
  navTabs: {
    display: 'flex',
    gap: 0,
    padding: '0 30px',
    borderBottom: '1px solid #ddd',
    background: 'white',
  },
  navTab: {
    padding: '14px 20px',
    background: 'transparent',
    color: '#666',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: '12px',
    letterSpacing: '0.5px',
    borderBottom: '3px solid transparent',
    transition: 'all 0.3s',
  },
  navTabActive: {
    color: '#667eea',
    borderBottomColor: '#667eea',
  },
  content: {
    padding: '30px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '30px',
  },
  statCard: {
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    padding: '20px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: '8px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#999',
    textTransform: 'uppercase',
  },
  actionButtons: {
    display: 'flex',
    gap: '12px',
    marginBottom: '30px',
    flexWrap: 'wrap',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  section: {
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    padding: '20px',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#333',
    textTransform: 'uppercase',
    borderBottom: '2px solid #667eea',
    paddingBottom: '8px',
  },
  todoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    background: '#f9f9f9',
    borderRadius: '4px',
    marginBottom: '8px',
    borderLeft: '4px solid #667eea',
  },
  alertItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    background: '#f9f9f9',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '13px',
  },
  input: {
    background: 'white',
    border: '1px solid #ddd',
    color: '#333',
    padding: '10px 12px',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '13px',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  btnSecondary: {
    background: '#f0f0f0',
    color: '#333',
    border: '1px solid #ddd',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  demoSection: {
    textAlign: 'center',
    borderTop: '1px solid #eee',
    paddingTop: '20px',
  },
  demoTitle: {
    fontSize: '12px',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: '10px',
    fontWeight: 'bold',
  },
  demoBtn: {
    background: '#f0f0f0',
    border: '1px solid #ddd',
    padding: '8px 16px',
    margin: '0 4px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  formContainer: {
    background: '#f9f9f9',
    border: '2px solid #667eea',
    padding: '20px',
    marginBottom: '20px',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  table: {
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  tableRow: {
    display: 'flex',
    gap: '12px',
    padding: '15px',
    borderBottom: '1px solid #eee',
    alignItems: 'center',
    fontSize: '13px',
    flexWrap: 'wrap',
  },
  deleteBtn: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: 'auto',
  },
};

export default PrintingPressSystem;
