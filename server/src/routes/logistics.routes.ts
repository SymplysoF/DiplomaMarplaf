import { Router, Request, Response } from 'express';

const router = Router();

router.post('/route', async (req: Request, res: Response) => {
    try {
        const { from, to } = req.body;

        if (
            !from ||
            !to ||
            typeof from.lat !== 'number' ||
            typeof from.lng !== 'number' ||
            typeof to.lat !== 'number' ||
            typeof to.lng !== 'number'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Некорректные координаты from/to'
            });
        }

        if (!process.env.ORS_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'ORS_API_KEY не задан в .env'
            });
        }

        const orsResponse = await fetch(
            'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
            {
                method: 'POST',
                headers: {
                    Authorization: process.env.ORS_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    coordinates: [
                        [from.lng, from.lat],
                        [to.lng, to.lat]
                    ]
                })
            }
        );

        const data: any = await orsResponse.json();

        if (!orsResponse.ok) {
            return res.status(orsResponse.status).json({
                success: false,
                message:
                    data?.error?.message ||
                    data?.message ||
                    'Ошибка OpenRouteService',
                raw: data
            });
        }

        const feature = data?.features?.[0];
        const summary = feature?.properties?.summary;

        return res.json({
            success: true,
            geometry: feature?.geometry || null,
            distanceMeters: summary?.distance ?? null,
            durationSeconds: summary?.duration ?? null
        });
    } catch (error: any) {
        console.error('ORS route error:', error);
        return res.status(500).json({
            success: false,
            message: error?.message || 'Ошибка сервера'
        });
    }
});

export default router;