import { useEffect, useState } from "react";
import Authorization from "../pages/Authorization";
import axios from "axios";

function AddCard() {
    const [showViewModal, setShowModal] = useState(false);
    const [productData, setProductData] = useState({
        name
    })
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await axios.get('http://localhost:5000/categories', {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('userToken')}`,
                    },
                });
                // setCategories(response.data.rows);
            }
            catch (error) {
                console.error(error);
            }
        };
    }, []);

}