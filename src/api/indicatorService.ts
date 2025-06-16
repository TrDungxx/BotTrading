import axios from 'axios';

const BASE_URL = 'http://localhost:5002/api/proxy/indicators'; // hoặc domain của backend

export const getAllIndicators = () =>
  axios.get(BASE_URL);

export const getIndicatorById = (id: number) =>
  axios.get(`${BASE_URL}/getById?id=${id}`);

export const createIndicator = (data: any) =>
  axios.post(`${BASE_URL}/create`, data);

export const updateIndicator = (data: any) =>
  axios.put(`${BASE_URL}/update`, data);

export const deleteIndicator = (id: number) =>
  axios.delete(`${BASE_URL}/delete`, { data: { id } });
