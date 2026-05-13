import React, { useState } from 'react';

function App() {
  const [tab, setTab] = useState('dash');
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('admin@printshop.com');
  const [pass, setPass] = useState('admin123');

  if (!user) {
    return (
      <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea, #764ba2)'}}>
        <div style={{background: 'white', padding: '40px', borderRadius: '8px', width: '400px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)'}}>
          <h1 style={{textAlign: 'center', marginBottom: '30px'}}>🖨️ Print Shop</h1>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px'}} />
          <input type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} style={{width: '100%', padding: '10px', marginBottom: '20px', border: '1px solid #ddd', borderRadius: '4px'}} />
          <button onClick={() => {if(email && pass) setUser({name: 'User'})}} style={{width: '100%', padding: '10px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight: '100vh', background: '#f5f5f5'}}>
      <header style={{background: 'white', padding: '20px', borderBottom: '2px solid #667eea', display: 'flex', justifyContent: 'space-between'}}>
        <h1>🖨️ Print Shop Manager</h1>
        <button onClick={() => setUser(null)} style={{padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Logout</button>
      </header>

      <nav style={{background: 'white', padding: '0 20px', borderBottom: '1px solid #ddd', display: 'flex', gap: '20px'}}>
        <button onClick={() => setTab('dash')} style={{padding: '15px 20px', background: 'none', border: 'none', borderBottom: tab === 'dash' ? '3px solid #667eea' : 'none', cursor: 'pointer', fontWeight: 'bold', color: tab === 'dash' ? '#667eea' : '#666'}}>Dashboard</button>
        <button onClick={() => setTab('sales')} style={{padding: '15px 20px', background: 'none', border: 'none', borderBottom: tab === 'sales' ? '3px solid #667eea' : 'none', cursor: 'pointer', fontWeight: 'bold', color: tab === 'sales' ? '#667eea' : '#666'}}>Sales</button>
        <button onClick={() => setTab('expenses')} style={{padding: '15px 20px', background: 'none', border: 'none', borderBottom: tab === 'expenses' ? '3px solid #667eea' : 'none', cursor: 'pointer', fontWeight: 'bold', color: tab === 'expenses' ? '#667eea' : '#666'}}>Expenses</button>
        <button onClick={() => setTab('tasks')} style={{padding: '15px 20px', background: 'none', border: 'none', borderBottom: tab === 'tasks' ? '3px solid #667eea' : 'none', cursor: 'pointer', fontWeight: 'bold', color: tab === 'tasks' ? '#667eea' : '#666'}}>Tasks</button>
      </nav>

      <div style={{padding: '30px', maxWidth: '1200px', margin: '0 auto'}}>
        {tab === 'dash' && (
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px'}}>
            <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderTop: '4px solid #10b981'}}>
              <h3 style={{color: '#666', marginBottom: '10px'}}>Monthly Income</h3>
              <p style={{fontSize: '32px', fontWeight: 'bold', color: '#10b981'}}>GH₵5,680</p>
            </div>
            <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderTop: '4px solid #ef4444'}}>
              <h3 style={{color: '#666', marginBottom: '10px'}}>Monthly Expenses</h3>
              <p style={{fontSize: '32px', fontWeight: 'bold', color: '#ef4444'}}>GH₵3,450</p>
            </div>
            <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderTop: '4px solid #3b82f6'}}>
              <h3 style={{color: '#666', marginBottom: '10px'}}>Monthly Profit</h3>
              <p style={{fontSize: '32px', fontWeight: 'bold', color: '#3b82f6'}}>GH₵2,230</p>
            </div>
            <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderTop: '4px solid #8b5cf6'}}>
              <h3 style={{color: '#666', marginBottom: '10px'}}>Pending Tasks</h3>
              <p style={{fontSize: '32px', fontWeight: 'bold', color: '#8b5cf6'}}>3</p>
            </div>
          </div>
        )}

        {tab === 'sales' && (
          <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
            <h2>Sales Records</h2>
            <p style={{marginTop: '20px'}}>117 sales records imported from Manus</p>
            <p style={{fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginTop: '10px'}}>Total: GH₵76,657</p>
          </div>
        )}

        {tab === 'expenses' && (
          <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
            <h2>Expenses</h2>
            <p style={{marginTop: '20px'}}>39 expense records imported from Manus</p>
            <p style={{fontSize: '24px', fontWeight: 'bold', color: '#ef4444', marginTop: '10px'}}>Total: GH₵25,498</p>
          </div>
        )}

        {tab === 'tasks' && (
          <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
            <h2>Tasks</h2>
            <div style={{marginTop: '20px'}}>
              <div style={{background: '#f9f9f9', padding: '10px', marginBottom: '10px', borderRadius: '4px', borderLeft: '4px solid #667eea'}}>✓ Refill ink cartridges</div>
              <div style={{background: '#f9f9f9', padding: '10px', marginBottom: '10px', borderRadius: '4px', borderLeft: '4px solid #667eea'}}>✓ Check Press efficiency</div>
              <div style={{background: '#f9f9f9', padding: '10px', marginBottom: '10px', borderRadius: '4px', borderLeft: '4px solid #667eea'}}>✓ Order paper stock</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
