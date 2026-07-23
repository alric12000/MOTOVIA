#!/bin/bash
sed -i 's/productId: '\''\'',/productId: '\'', platform: '\''Instagram'\'', notes: '\'',/g' src/components/SalesPage.tsx
