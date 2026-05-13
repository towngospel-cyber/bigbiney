import React, { useState } from 'react';

export default function App() {
  const [email, setEmail] = useState('admin@printshop.com');
  const [password, setPassword] = useState('admin123');
  const [loggedIn, setLoggedIn] = useState(false);

  const handleLogin = () => {
    if (email && password) {
      setLoggedIn(true);
    }
  };

  if (loggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1>✅ Print Shop Manager</h1>
          <p>App is working successfully!</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3>Monthly Income</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>GH₵5,680</p>
            </div>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3>Monthly Expenses</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>GH₵3,450</p>
            </div>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3>Monthly Profit</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>GH₵2,230</p>
            </div>
          </div>
          <button 
            onClick={() => setLoggedIn(false)}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '400px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>🖨️ Print Shop Manager</h1>
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
        />
        
        <button
          onClick={handleLogin}
          style={{ width: '100%', padding: '12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          Sign In
        </button>

        <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>Demo Account Pre-filled</p>
          <p style={{ fontSize: '12px', color: '#666' }}>Just click Sign In</p>
        </div>
      </div>
    </div>
  );
}
