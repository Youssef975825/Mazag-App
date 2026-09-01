import React, { useState, useEffect } from 'react';
import Chat from './components/Chat';
import Login from './components/Login';

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // أول ما التطبيق يفتح، نتأكد لو فيه اسم متخزن قبل كده
  useEffect(() => {
    const savedUser = localStorage.getItem('mazag_user');
    if (savedUser) {
      setCurrentUser(savedUser);
    }
  }, []);

  // دالة بتشتغل أول ما يعمل تسجيل دخول ناجح
  const handleLoginSuccess = (name: string) => {
    setCurrentUser(name);
  };

  return (
    <div className="w-full h-screen">
      {!currentUser ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Chat />
      )}
    </div>
  );
}