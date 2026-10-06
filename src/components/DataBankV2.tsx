import React from 'react';
import { DataBank, type DataBankProps } from './DataBank';

export const DataBankV2: React.FC<DataBankProps> = (props) => {
  return <DataBank {...props} />;
};
