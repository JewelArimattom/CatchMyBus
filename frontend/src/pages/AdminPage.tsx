import { useState } from 'react';
import { Plus, Bus, MapPin, Save, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';

interface StopTiming {
  stopName: string;
  arrivalTime: string;
  period: 'AM' | 'PM';
}

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState<'buses' | 'stops'>('buses');
  const [busForm, setBusForm] = useState({
    busName: '',
    from: '',
    via: '',
    to: '',
    type: 'KSRTC',
  });
  const [stopTimings, setStopTimings] = useState<StopTiming[]>([
    { stopName: '', arrivalTime: '', period: 'AM' }
  ]);
  
  const [stopForm, setStopForm] = useState({
    name: '',
    district: '',
    lat: '',
    lng: '',
  });

  const addStopTimingField = () => {
    setStopTimings([...stopTimings, { stopName: '', arrivalTime: '', period: 'AM' }]);
  };

  const removeStopTimingField = (index: number) => {
    if (stopTimings.length > 1) {
      const updated = stopTimings.filter((_, i) => i !== index);
      setStopTimings(updated);
    }
  };

  const updateStopTiming = (index: number, field: 'stopName' | 'arrivalTime' | 'period', value: string) => {
    const updated = [...stopTimings];
    if (field === 'period') {
      updated[index][field] = value as 'AM' | 'PM';
    } else {
      updated[index][field] = value;
    }
    setStopTimings(updated);
  };

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that all stops have names and times
    const hasEmptyFields = stopTimings.some(st => !st.stopName.trim() || !st.arrivalTime.trim());
    if (hasEmptyFields) {
      toast.error('Please fill all stop names and times');
      return;
    }

    const busData = {
      busName: busForm.busName,
      from: busForm.from,
      via: busForm.via,
      to: busForm.to,
      type: busForm.type,
      route: stopTimings.map(st => st.stopName.trim()),
      timings: stopTimings.map(st => ({
        stop: st.stopName.trim(),
        time: `${st.arrivalTime} ${st.period}`
      }))
    };
    
    console.log('Attempting to add bus with data:', busData);
    console.log('API base URL:', api.defaults.baseURL);
    
    try {
      const response = await api.post('/admin/buses', busData);
      console.log('✅ Bus added successfully:', response.data);
      toast.success('Bus added successfully!');
      setBusForm({ busName: '', from: '', via: '', to: '', type: 'KSRTC' });
      setStopTimings([{ stopName: '', arrivalTime: '', period: 'AM' }]);
    } catch (error: any) {
      console.error('❌ Error adding bus:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        request: error.request,
        config: error.config
      });
      
      if (error.code === 'ERR_NETWORK') {
        toast.error('Network Error: Cannot connect to backend server');
      } else if (error.response) {
        const errorMessage = error.response?.data?.error || `Server error: ${error.response.status}`;
        toast.error(errorMessage);
      } else {
        toast.error(error.message || 'Failed to add bus');
      }
    }
  };

  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/stops', {
        ...stopForm,
        location: {
          lat: parseFloat(stopForm.lat),
          lng: parseFloat(stopForm.lng),
        },
      });
      toast.success('Bus stop added successfully!');
      setStopForm({ name: '', district: '', lat: '', lng: '' });
    } catch (error) {
      console.error('Error adding stop:', error);
      toast.error('Failed to add bus stop');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Panel</h1>
          <p className="text-gray-600">Manage buses and stops in the system</p>
        </div>

        {/* Warning */}
        <div className="card bg-yellow-50 border-2 border-yellow-300 mb-6">
          <div className="flex items-start">
            <AlertCircle className="h-6 w-6 text-yellow-600 mr-3 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Admin Access</h3>
              <p className="text-sm text-gray-700">
                This panel is for administrators only. All changes will be immediately
                visible to users.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setActiveTab('buses')}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'buses'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Bus className="h-5 w-5 mr-2" />
            Manage Buses
          </button>
          <button
            onClick={() => setActiveTab('stops')}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'stops'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <MapPin className="h-5 w-5 mr-2" />
            Manage Stops
          </button>
        </div>

        {/* Bus Form */}
        {activeTab === 'buses' && (
          <div className="card animate-slide-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <Plus className="h-6 w-6 mr-2 text-primary-600" />
              Add New Bus
            </h2>

            <form onSubmit={handleAddBus} className="space-y-6">
              {/* Bus Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bus Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Trivandrum - Kochi Express"
                  value={busForm.busName}
                  onChange={(e) => setBusForm({ ...busForm, busName: e.target.value })}
                  required
                />
              </div>

              {/* From → Via → To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Route Details *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="From (e.g., Trivandrum)"
                      value={busForm.from}
                      onChange={(e) => setBusForm({ ...busForm, from: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Via (e.g., Kollam)"
                      value={busForm.via}
                      onChange={(e) => setBusForm({ ...busForm, via: e.target.value })}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="To (e.g., Kochi)"
                      value={busForm.to}
                      onChange={(e) => setBusForm({ ...busForm, to: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  From → Via → To (Via is optional)
                </p>
              </div>

              {/* Bus Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bus Type *
                </label>
                <select
                  className="input-field"
                  value={busForm.type}
                  onChange={(e) => setBusForm({ ...busForm, type: e.target.value })}
                  required
                >
                  <option value="KSRTC">KSRTC</option>
                  <option value="Private">Private</option>
                  <option value="Fast">Fast</option>
                  <option value="Super Fast">Super Fast</option>
                  <option value="Ordinary">Ordinary</option>
                </select>
              </div>

              {/* Stop Name and Time Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Stops and Timings *
                </label>
                
                <div className="space-y-3">
                  {stopTimings.map((stopTiming, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      {/* Stop Name Input */}
                      <div className="flex-1">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g., Thiruvananthapuram Central"
                          value={stopTiming.stopName}
                          onChange={(e) => updateStopTiming(index, 'stopName', e.target.value)}
                          required
                        />
                      </div>

                      {/* Time Input (12-hour format) */}
                      <div className="w-32">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="HH:MM"
                          value={stopTiming.arrivalTime}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow only numbers and colon
                            if (/^[0-9:]*$/.test(value)) {
                              updateStopTiming(index, 'arrivalTime', value);
                            }
                          }}
                          maxLength={5}
                          required
                        />
                      </div>

                      {/* AM/PM Selector */}
                      <div className="w-24">
                        <select
                          className="input-field"
                          value={stopTiming.period}
                          onChange={(e) => updateStopTiming(index, 'period', e.target.value)}
                          required
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>

                      {/* Remove Button (only show if more than 1 stop) */}
                      {stopTimings.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStopTimingField(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove stop"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Stop Button */}
                <button
                  type="button"
                  onClick={addStopTimingField}
                  className="mt-3 flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  Add Another Stop
                </button>
              </div>

              {/* Submit Button */}
              <button type="submit" className="btn-primary w-full">
                <Save className="h-5 w-5 inline mr-2" />
                Add Bus
              </button>
            </form>
          </div>
        )}

        {/* Stop Form */}
        {activeTab === 'stops' && (
          <div className="card animate-slide-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <Plus className="h-6 w-6 mr-2 text-primary-600" />
              Add New Bus Stop
            </h2>

            <form onSubmit={handleAddStop} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stop Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Thiruvananthapuram Central"
                  value={stopForm.name}
                  onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  District *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Thiruvananthapuram"
                  value={stopForm.district}
                  onChange={(e) => setStopForm({ ...stopForm, district: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="input-field"
                    placeholder="e.g., 8.5241"
                    value={stopForm.lat}
                    onChange={(e) => setStopForm({ ...stopForm, lat: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="input-field"
                    placeholder="e.g., 76.9366"
                    value={stopForm.lng}
                    onChange={(e) => setStopForm({ ...stopForm, lng: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary w-full">
                <Save className="h-5 w-5 inline mr-2" />
                Add Bus Stop
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
