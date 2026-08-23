const srs = {
    // quality: 1 (Снова), 2 (Трудно), 3 (Хорошо), 4 (Легко)
    calculate: (quality, interval, ease) => {
        let newInterval = 0;
        let newEase = ease;

        if (quality === 1) {
            newInterval = 0; // Сбрасываем интервал
            newEase = Math.max(1.3, ease - 0.2); // Уменьшаем "легкость"
        } else {
            if (interval === 0) {
                if (quality === 2) newInterval = 1;
                if (quality === 3) newInterval = 1;
                if (quality === 4) newInterval = 4;
            } else {
                if (quality === 2) newInterval = Math.round(interval * 1.2);
                if (quality === 3) newInterval = Math.round(interval * ease);
                if (quality === 4) newInterval = Math.round(interval * ease * 1.3);
            }
            // Корректируем легкость
            if (quality === 2) newEase = Math.max(1.3, ease - 0.15);
            if (quality === 4) newEase = ease + 0.15;
        }

        return { interval: newInterval, ease: newEase };
    }
};