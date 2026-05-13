import React, { useState } from 'react';

export default function PrintingPressSystem() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [showLoginForm, setShowLoginForm] = useState(true);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  
  const accounts = [
    { id: 1, email: 'admin@printshop.com', password: 'admin123', name: 'Admin User' },
    { id: 2, email: 'user@printshop.com', password: 'user123', name: 'Standard User' },
  ];

  const [sales, setSales] = useState([
    { date: '2026-05-11', amount: 1350 },
    { date: '2026-05-09', amount: 2000 },
    { date: '2026-05-08', amount: 1950 },
    { date: '2026-05-07', amount: 2460 },
    { date: '2026-05-06', amount: 700 },
    { date: '2026-05-05', amount: 1450 },
    { date: '2026-05-04', amount: 1930 },
    { date: '2026-05-02', amount: 1000 },
    { date: '2026-05-01', amount: 2360 },
  ]);

  const [expenses, setExpenses] = useState([
    { date: '2026-05-11', category: 'Other', description: 'tshirt', amount: 600 },
    { date: '2026-05-09', category: 'Other', description: 'supplies', amount: 950 },
    { date: '2026-05-08', category: 'Paper', description: 'paper stock', amount: 1300 },
    { date: '2026-05-02', category: 'Other', description: 'T-shirt', amount: 850 },
    { date: '2026-05-02', category: 'Other', description: 'Flexy', amount: 650 },
  ]);

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
      setShowLoginForm(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowLoginForm(true);
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
    printWindow.document.write(`
      <html><head><title>Financial Report</title></head><body style="font-family: Arial; padding: 20px;">
      <h1>PRINT SHOP MANAGER - FINANCIAL REPORT</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <h2>MONTHLY STATISTICS (${getCurrentMonth()})</h2>
      <p><strong>Monthly Income:</strong> GH₵${stats.monthlySales.toLocaleString()}</p>
      <p><strong>Monthly Expenses:</strong> GH₵${stats.monthlyExpenses.toLocaleString()}</p>
      <p><strong>Monthly Profit:</strong> GH₵${(stats.monthlySales - stats.monthlyExpenses).toLocaleString()}</p>
      <h2>ALL-TIME STATISTICS</h2>
      <p><strong>Total Income:</strong> GH₵${stats.totalSales.toLocaleString()}</p>
      <p><strong>Total Expenses:</strong> GH₵${stats.totalExpenses.toLocaleString()}</p>
      <p><strong>Net Profit:</strong> GH₵${(stats.totalSales - stats.totalExpenses).toLocaleString()}</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const exportData = () => {
    const stats = getMonthlyStats();
    const data = {
      exportDate: new Date().toISOString(),
      user: currentUser?.name,
      stats: stats,
      sales,
      expenses,
      todos,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addTodo = () => {
    if (todoInput.trim()) {
      setTodos([...todos, { id: Date.now(), text: todoInput, completed: false, priority: 'medium' }]);
      setTodoInput('');
      setShowTodoForm(false);
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
      setSales([...sales, { date: salesFormData.date, amount: parseFloat(salesFormData.amount) }]);
      setSalesFormData({ date: '', amount: '' });
      setShowSalesForm(false);
    }
  };

  const addExpense = () => {
    if (expenseFormData.date && expenseFormData.amount) {
      setExpenses([...expenses, { date: expenseFormData.date, category: expenseFormData.category, description: expenseFormData.description, amount: parseFloat(expenseFormData.amount) }]);
      setExpenseFormData({ date: '', category: 'Paper', description: '', amount: '' });
      setShowExpenseForm(false);
    }
  };

  const stats = getMonthlyStats();

  if (showLoginForm) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'Arial' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '400px' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', color: '#333' }}>🖨️ Print Shop Manager</h1>
          <p style={{ color: '#999', fontSize: '14px', marginBottom: '30px' }}>Financial Management System</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
            <input type="email" placeholder="Email" value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })} style={{ background: 'white', border: '1px solid #ddd', color: '#333', padding: '10px 12px', borderRadius: '4px', fontSize: '13px' }} onKeyPress={e => e.key === 'Enter' && handleLogin()} />
            <input type="password" placeholder="Password" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} style={{ background: 'white', border: '1px solid #ddd', color: '#333', padding: '10px 12px', borderRadius: '4px', fontSize: '13px' }} onKeyPress={e => e.key === 'Enter' && handleLogin()} />
            <button onClick={handleLogin} style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Sign In</button>
          </div>

          <div style={{ textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <p style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 'bold' }}>Demo Accounts:</p>
            <button onClick={() => setLoginData({ email: 'admin@printshop.com', password: 'admin123' })} style={{ background: '#f0f0f0', border: '1px solid #ddd', padding: '8px 16px', margin: '0 4px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Admin</button>
            <button onClick={() => setLoginData({ email: 'user@printshop.com', password: 'user123' })} style={{ background: '#f0f0f0', border: '1px solid #ddd', padding: '8px 16px', margin: '0 4px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>User</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)', fontFamily: 'Arial' }}>
      <header style={{ background: 'white', borderBottom: '2px solid #667eea', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>🖨️ PRINT SHOP MANAGER</h1>
          <p style={{ fontSize: '12px', color: '#999' }}>Financial Management & Task Tracking</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifications(!showNotifications)} style={{ background: '#f0f0f0', border: '1px solid #ddd', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '18px', position: 'relative' }}>
              🔔
              {notifications.filter(n => !n.read).length > 0 && (
                <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>{notifications.filter(n => !n.read).length}</span>
              )}
            </button>
            {showNotifications && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', width: '300px', maxHeight: '300px', overflowY: 'auto', padding: '15px', marginTop: '10px', zIndex: 1000 }}>
                <h3>Notifications</h3>
                {notifications.map(notif => (
                  <div key={notif.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f9f9f9', borderRadius: '4px', marginBottom: '8px', fontSize: '13px' }}>
                    <p>{notif.message}</p>
                    <button onClick={() => setNotifications(notifications.filter(n => n.id !== notif.id))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#999' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f5f5f5', borderRadius: '4px', fontSize: '13px', fontWeight: '500' }}>
            👤 {currentUser?.name}
          </div>
          <button onClick={handleLogout} style={{ background: '#f0f0f0', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 0, padding: '0 30px', borderBottom: '1px solid #ddd', background: 'white' }}>
        {['dashboard', 'sales', 'expenses', 'todos'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '14px 20px', background: 'transparent', color: activeTab === tab ? '#667eea' : '#666', border: 'none', cursor: 'pointer', fontWeight: '600', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px', borderBottom: activeTab === tab ? '3px solid #667eea' : '3px solid transparent', transition: 'all 0.3s' }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '30px' }}>
              <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '4px solid #10b981' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea', marginBottom: '8px' }}>GH₵{stats.monthlySales.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Monthly Income</div>
              </div>
              <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '4px solid #ef4444' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea', marginBottom: '8px' }}>GH₵{stats.monthlyExpenses.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Monthly Expenses</div>
              </div>
              <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '4px solid #3b82f6' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea', marginBottom: '8px' }}>GH₵{(stats.monthlySales - stats.monthlyExpenses).toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Monthly Profit</div>
              </div>
              <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '4px solid #8b5cf6' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea', marginBottom: '8px' }}>{todos.filter(t => !t.completed).length}</div>
                <div style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Pending Tasks</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Print Report</button>
              <button onClick={exportData} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📥 Export Data</button>
              <button onClick={() => setShowTodoForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>➕ Add Task</button>
            </div>

            <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '20px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#333', textTransform: 'uppercase', borderBottom: '2px solid #667eea', paddingBottom: '8px' }}>Pending Tasks</h2>
              {todos.filter(t => !t.completed).map(todo => (
                <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f9f9f9', borderRadius: '4px', marginBottom: '8px', borderLeft: '4px solid #667eea' }}>
                  <input type="checkbox" onChange={() => toggleTodo(todo.id)} />
                  <span>{todo.text}</span>
                  <button onClick={() => deleteTodo(todo.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto', fontSize: '12px' }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>Sales Records: {sales.length} total</h2>
            <p style={{ fontSize: '18px', color: '#10b981', fontWeight: 'bold' }}>Total: GH₵{sales.reduce((s, t) => s + t.amount, 0).toLocaleString()}</p>
            <button onClick={() => setShowSalesForm(!showSalesForm)} style={{ marginTop: '15px', background: '#667eea', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Record Sale</button>
            {showSalesForm && (
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <input type="date" value={salesFormData.date} onChange={e => setSalesFormData({ ...salesFormData, date: e.target.value })} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
                <input type="number" placeholder="Amount (GH₵)" value={salesFormData.amount} onChange={e => setSalesFormData({ ...salesFormData, amount: e.target.value })} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
                <button onClick={addSale} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Add</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'expenses' && (
          <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>Expenses: {expenses.length} total</h2>
            <p style={{ fontSize: '18px', color: '#ef4444', fontWeight: 'bold' }}>Total: GH₵{expenses.reduce((s, t) => s + t.amount, 0).toLocaleString()}</p>
            <button onClick={() => setShowExpenseForm(!showExpenseForm)} style={{ marginTop: '15px', background: '#667eea', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Expense</button>
            {showExpenseForm && (
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input type="date" value={expenseFormData.date} onChange={e => setExpenseFormData({ ...expenseFormData, date: e.target.value })} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
                <select value={expenseFormData.category} onChange={e => setExpenseFormData({ ...expenseFormData, category: e.target.value })} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option>Paper</option>
                  <option>Ink & Toner</option>
                  <option>Maintenance</option>
                  <option>Salaries</option>
                  <option>Other</option>
                </select>
                <input type="text" placeholder="Description" value={expenseFormData.description} onChange={e => setExpenseFormData({ ...expenseFormData, description: e.target.value })} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', flex: 1, minWidth: '200px' }} />
                <input type="number" placeholder="Amount" value={expenseFormData.amount} onChange={e => setExpenseFormData({ ...expenseFormData, amount: e.target.value })} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
                <button onClick={addExpense} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Add</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'todos' && (
          <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>Tasks: {todos.length} total</h2>
            <p style={{ marginBottom: '20px' }}>✅ Completed: {todos.filter(t => t.completed).length}</p>
            <button onClick={() => setShowTodoForm(!showTodoForm)} style={{ background: '#667eea', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px' }}>+ Add Task</button>
            {showTodoForm && (
              <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <input type="text" placeholder="Task description..." value={todoInput} onChange={e => setTodoInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && addTodo()} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }} />
                <button onClick={addTodo} style={{ background: '#667eea', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Add</button>
              </div>
            )}
            {todos.map(todo => (
              <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: todo.completed ? '#f0f0f0' : '#f9f9f9', borderRadius: '4px', marginBottom: '8px', borderLeft: `4px solid ${todo.completed ? '#ccc' : '#667eea'}`, opacity: todo.completed ? 0.6 : 1 }}>
                <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo.id)} />
                <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>{todo.text}</span>
                <button onClick={() => deleteTodo(todo.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto', fontSize: '12px' }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
