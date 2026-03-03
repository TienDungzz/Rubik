import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const sizes = [
    { id: 2, label: '2x2', desc: 'Easy', valid: true },
    { id: 3, label: '3x3', desc: 'Classic', valid: true },
    { id: 4, label: '4x4', desc: 'Comming soon', valid: false }
];

export default function Home() {
    const [selectedSize, setSelectedSize] = useState(null);
    const navigate = useNavigate();

    const handleStart = () => {
        if (selectedSize) {
            navigate('/play', { state: { size: selectedSize } });
        }
    };

    return (
        <div className="overlay-container">
            <motion.h1
                className="home-title"
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                Rubik's Cube
            </motion.h1>

            <motion.p
                style={{ marginBottom: '2rem', fontSize: '1.2rem', opacity: 0.8 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
            >
                Select your challenge
            </motion.p>

            <motion.div
                className="size-selector"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
            >
                {sizes.map(size => (
                    <button
                        key={size.id}
                        className="size-btn"
                        disabled={!size.valid}
                        style={{
                            borderColor: selectedSize === size.id ? '#00b4db' : 'rgba(255,255,255,0.2)',
                            background: selectedSize === size.id ? 'rgba(0, 180, 219, 0.2)' : 'rgba(255,255,255,0.1)',
                            transform: selectedSize === size.id ? 'translateY(-10px)' : 'none',
                            boxShadow: selectedSize === size.id ? '0 10px 20px rgba(0, 180, 219, 0.4)' : 'none'
                        }}
                        onClick={() => setSelectedSize(size.id)}
                    >
                        {size.label}
                        <span>{size.desc}</span>
                    </button>
                ))}
            </motion.div>

            <motion.button
                className={`start-btn ${selectedSize ? 'active' : ''}`}
                onClick={handleStart}
                initial={{ opacity: 0 }}
                animate={{ opacity: selectedSize ? 1 : 0.5 }}
                whileHover={selectedSize ? { scale: 1.05 } : {}}
                whileTap={selectedSize ? { scale: 0.95 } : {}}
            >
                Decrypt Memories
            </motion.button>
        </div>
    );
}
