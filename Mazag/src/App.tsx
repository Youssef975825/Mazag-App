import React from "react";
import Chat from "./components/Chat";

// كل منطق تسجيل الدخول (هل فيه يوزر ولا لأ) بقى جوّه Chat.tsx
// عن طريق Firebase Auth (onAuthStateChanged)، فـ App.tsx مبقاش
// محتاج يتأكد من حاجة بنفسه - وده بيمنع تعارض بين مصدرين مختلفين
// لمعرفة حالة تسجيل الدخول (localStorage القديم vs Firebase الحقيقي).
export default function App() {
  return (
    <div className="w-full h-screen">
      <Chat />
    </div>
  );
}