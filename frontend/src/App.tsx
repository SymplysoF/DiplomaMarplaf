// import React, { useState, useEffect } from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import Authorization from './pages/Authorization';
// import Home from './pages/HomePage';
// import FarmersPlacesBuyerPage from './pages/FarmersPlacesBuyerPage';
// import 'bootstrap/dist/css/bootstrap.min.css';
// import 'bootstrap-icons/font/bootstrap-icons.css';

// const App: React.FC = () => {
//   const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
//     !!localStorage.getItem('userToken')
//   );

//   // Слушаем изменения localStorage
//   useEffect(() => {
//     const checkAuth = () => {
//       setIsAuthenticated(!!localStorage.getItem('userToken'));
//     };

//     checkAuth();
//     window.addEventListener('storage', checkAuth);
//     window.addEventListener('auth-change', checkAuth);

//     return () => {
//       window.removeEventListener('storage', checkAuth);
//       window.removeEventListener('auth-change', checkAuth);
//     };
//   }, []);

//   return (
//     <Router>
//       <Routes>
//         <Route path="/" element={<Authorization />} />
//         <Route
//           path="/home"
//           element={
//             isAuthenticated ? <Home /> : <Navigate to="/" />
//           }
//         />
//         <Route
//           path="*"
//           element={<Navigate to="/" />}
//         />
//       </Routes>
//     </Router>
//   );
// };

// export default App;
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Authorization from './pages/Authorization';
import Home from './pages/HomePage';
import FarmersPlacesBuyerPage from './pages/FarmersPlacesBuyerPage';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    !!localStorage.getItem('userToken')
  );

  // Слушаем изменения localStorage
  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(!!localStorage.getItem('userToken'));
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    window.addEventListener('auth-change', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('auth-change', checkAuth);
    };
  }, []);

  return (
    <Router>
      {/* Глобальный контейнер с размером шрифта 16pt */}
      {/* <div style={{ fontSize: '16pt' }}> */}
        <Routes>
          <Route path="/" element={<Authorization />} />
          <Route
            path="/home"
            element={
              isAuthenticated ? <Home /> : <Navigate to="/" />
            }
          />
          <Route
            path="*"
            element={<Navigate to="/" />}
          />
        </Routes>
      {/* </div> */}
      {/* Дополнительный стиль для корневого элемента (улучшает совместимость с модальными окнами) */}
      {/* <style>{`
        body, html, #root {
          font-size: 16pt;
        }
      `}</style> */}
    </Router>
  );
};

export default App;