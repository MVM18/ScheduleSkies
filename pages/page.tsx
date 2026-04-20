'use client';

import React from 'react';
import { 
  LuUser, 
  LuMail, 
  LuMapPin, 
  LuPhone, 
  LuCamera, 
  LuSettings,
  LuPencil
} from 'react-icons/lu';

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Profile Header Card */}
        <div className="bg-white shadow rounded-2xl overflow-hidden">
          {/* Cover Photo */}
          <div className="h-48 bg-gradient-to-r from-blue-500 to-indigo-600 relative">
            <button className="absolute bottom-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-2 rounded-full transition-colors">
              <LuCamera className="w-5 h-5" />
            </button>
          </div>
          
          {/* Avatar and Basic Info */}
          <div className="px-6 sm:px-10 pb-8 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between -mt-16 sm:-mt-12 space-y-4 sm:space-y-0">
              <div className="flex flex-col sm:flex-row items-center sm:items-end space-y-4 sm:space-y-0 sm:space-x-5">
                <div className="relative group">
                  <img 
                    className="w-32 h-32 rounded-full border-4 border-white shadow-md object-cover" 
                    src="https://ui-avatars.com/api/?name=User+Name&background=random&size=128" 
                    alt="User Avatar" 
                  />
                  <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 shadow-sm transition-colors">
                    <LuCamera className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-center sm:text-left pb-2">
                  <h1 className="text-2xl font-bold text-gray-900">John Doe</h1>
                  <p className="text-sm font-medium text-gray-500">Travel Enthusiast & Event Planner</p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3 pb-2">
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  <LuPencil className="w-4 h-4 mr-2" />
                  Edit Profile
                </button>
                <button className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors shadow-sm">
                  <LuSettings className="w-4 h-4 mr-2" />
                  Settings
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Contact & Personal Info */}
          <div className="col-span-1 bg-white shadow rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">About Me</h2>
            <div className="space-y-4">
              <div className="flex items-center text-gray-700">
                <LuUser className="w-5 h-5 mr-3 text-gray-400" />
                <span className="text-sm">Male, 28 years old</span>
              </div>
              <div className="flex items-center text-gray-700">
                <LuMail className="w-5 h-5 mr-3 text-gray-400" />
                <span className="text-sm">john.doe@example.com</span>
              </div>
              <div className="flex items-center text-gray-700">
                <LuPhone className="w-5 h-5 mr-3 text-gray-400" />
                <span className="text-sm">+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center text-gray-700">
                <LuMapPin className="w-5 h-5 mr-3 text-gray-400" />
                <span className="text-sm">New York, USA</span>
              </div>
            </div>
          </div>

          {/* Right Column: Bio / Activity / Stats */}
          <div className="col-span-1 md:col-span-2 bg-white shadow rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Bio</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Passionate traveler and meticulous event planner. I love exploring new cities, finding the best local coffee shops, and organizing group trips using Schedule Skies to ensure everything goes perfectly regardless of the weather!
            </p>
            
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Travel Stats</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">12</p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Upcoming Events</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">45</p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Places Visited</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">8</p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Groups Managed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}