import React from 'react';
import { ShoppingCart, HelpCircle, Grid3X3 } from 'lucide-react';

const Navbar = () => {
    return (
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shadow-sm z-10 sticky top-0">
            <div className="flex items-center space-x-3">
                <Grid3X3 className="text-blue-600" size={24} />
                <h1 className="text-xl font-bold tracking-tight text-gray-800">LATTICE <span className="font-light text-gray-500">CREATOR</span></h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-gray-600">
                <a href="#" className="hover:text-blue-600 transition-colors">Gallery</a>
                <a href="#" className="flex items-center space-x-1 hover:text-blue-600 transition-colors">
                    <HelpCircle size={16} />
                    <span>Help</span>
                </a>
                <a href="#" className="flex items-center space-x-1 hover:text-blue-600 transition-colors">
                    <ShoppingCart size={16} />
                    <span>Cart (9)</span>
                </a>
            </nav>
            <button className="md:hidden text-gray-600">
                <Grid3X3 size={24} />
            </button>
        </header>
    );
};

export default Navbar;
