import React from 'react';
import { UserDirectory } from '../components/users/UserDirectory';

export const UsersPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <UserDirectory />
    </div>
  );
};

