import { useState, useEffect } from 'react';

interface AccessCodeModalProps {
  onCodeVerified: () => void;
}

const CORRECT_CODE = "123456"; // Замените на ваш реальный код
const VERIFICATION_KEY = "avatar_access_verified";

export const AccessCodeModal = ({ onCodeVerified }: AccessCodeModalProps) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;

  useEffect(() => {
    // Проверяем, был ли код уже верифицирован
    const isVerified = localStorage.getItem(VERIFICATION_KEY) === 'true';
    if (isVerified) {
      onCodeVerified();
    }
  }, [onCodeVerified]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (attempts >= MAX_ATTEMPTS) {
      setError('Превышено максимальное количество попыток. Пожалуйста, обновите страницу.');
      return;
    }

    if (code === CORRECT_CODE) {
      // Сохраняем состояние верификации
      localStorage.setItem(VERIFICATION_KEY, 'true');
      onCodeVerified();
    } else {
      setAttempts(prev => prev + 1);
      setError(`Неверный код. Осталось попыток: ${MAX_ATTEMPTS - attempts - 1}`);
      setCode('');
    }
  };

  const handleReset = () => {
    localStorage.removeItem(VERIFICATION_KEY);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-md">
        <h2 className="text-xl font-semibold text-white mb-4">
          Введите код доступа
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Введите код"
              className="w-full px-4 py-2 bg-zinc-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={6}
              disabled={attempts >= MAX_ATTEMPTS}
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={attempts >= MAX_ATTEMPTS}
            >
              {attempts >= MAX_ATTEMPTS ? 'Доступ заблокирован' : 'Продолжить'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="w-full text-gray-400 hover:text-white py-2 text-sm"
            >
              Сбросить верификацию
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 