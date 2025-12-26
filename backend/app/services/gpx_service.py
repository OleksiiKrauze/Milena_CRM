"""
GPX Grid Generation Service

This service generates GPX files for field search grid operations.
The grid consists of cells labeled with columns (A, B, C...) and rows (1, 2, 3...).
Each cell has a waypoint at its center for navigation.
"""

import math
from datetime import datetime, timezone
from typing import List, Tuple
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom


def meters_to_degrees_lat(meters: float) -> float:
    """
    Convert meters to degrees of latitude.
    1 degree latitude ≈ 111,320 meters (constant at all latitudes)
    """
    return meters / 111320.0


def meters_to_degrees_lon(meters: float, latitude: float) -> float:
    """
    Convert meters to degrees of longitude at a given latitude.
    1 degree longitude ≈ 111,320 * cos(latitude) meters
    """
    lat_rad = math.radians(latitude)
    return meters / (111320.0 * math.cos(lat_rad))


def column_label(index: int) -> str:
    """
    Convert column index to letter label (0->A, 1->B, ..., 25->Z, 26->AA, etc.)
    """
    label = ""
    index += 1  # Make it 1-based for calculation
    while index > 0:
        index -= 1
        label = chr(65 + (index % 26)) + label
        index //= 26
    return label


def calculate_grid_points(
    center_lat: float,
    center_lon: float,
    cols: int,
    rows: int,
    cell_size_meters: float
) -> Tuple[List[dict], List[Tuple[float, float]]]:
    """
    Calculate grid waypoints and track lines.

    Args:
        center_lat: Latitude of grid center
        center_lon: Longitude of grid center
        cols: Number of columns
        rows: Number of rows
        cell_size_meters: Size of each cell in meters

    Returns:
        Tuple of (waypoints, track_points)
        - waypoints: List of dicts with lat, lon, name
        - track_points: List of (lat, lon) tuples forming grid lines
    """
    # Calculate grid dimensions in degrees
    grid_width_meters = cols * cell_size_meters
    grid_height_meters = rows * cell_size_meters

    # Calculate top-left corner (grid origin)
    # Move north by half the grid height, west by half the grid width
    half_height_deg = meters_to_degrees_lat(grid_height_meters / 2)
    half_width_deg = meters_to_degrees_lon(grid_width_meters / 2, center_lat)

    top_lat = center_lat + half_height_deg
    left_lon = center_lon - half_width_deg

    # Cell dimensions in degrees
    cell_height_deg = meters_to_degrees_lat(cell_size_meters)

    # Generate waypoints (cell centers)
    waypoints = []
    for row in range(rows):
        # Calculate latitude for this row (move south from top)
        # Cell center is at half cell size from top edge
        lat = top_lat - (row * cell_height_deg) - (cell_height_deg / 2)

        # Calculate longitude offset once per row for efficiency
        cell_width_deg = meters_to_degrees_lon(cell_size_meters, lat)

        for col in range(cols):
            # Calculate longitude for this column (move east from left)
            lon = left_lon + (col * cell_width_deg) + (cell_width_deg / 2)

            # Create waypoint label (e.g., A1, B2, C3)
            col_label = column_label(col)
            row_label = str(row + 1)
            name = f"{col_label}{row_label}"

            waypoints.append({
                "lat": lat,
                "lon": lon,
                "name": name
            })

    # Generate track lines (grid perimeter and internal lines)
    track_points = []

    # Calculate corner points of the grid
    top_left_lat = top_lat
    top_left_lon = left_lon
    top_right_lat = top_lat
    top_right_lon = left_lon + meters_to_degrees_lon(grid_width_meters, top_lat)
    bottom_left_lat = top_lat - meters_to_degrees_lat(grid_height_meters)
    bottom_left_lon = left_lon
    bottom_right_lat = top_lat - meters_to_degrees_lat(grid_height_meters)
    bottom_right_lon = left_lon + meters_to_degrees_lon(grid_width_meters, bottom_right_lat)

    # Draw horizontal lines (including top and bottom edges)
    for row in range(rows + 1):
        lat = top_lat - (row * cell_height_deg)

        # Calculate longitude at this latitude
        lon_left = left_lon
        lon_right = left_lon + meters_to_degrees_lon(grid_width_meters, lat)

        track_points.append((lat, lon_left))
        track_points.append((lat, lon_right))

    # Draw vertical lines (including left and right edges)
    for col in range(cols + 1):
        # Use a middle latitude for longitude calculation
        middle_lat = center_lat
        lon = left_lon + (col * meters_to_degrees_lon(cell_size_meters, middle_lat))

        # Draw from top to bottom
        track_points.append((top_lat, lon))
        track_points.append((bottom_left_lat, lon))

    # Add perimeter to close the grid (for better visualization)
    # Top edge: left to right
    track_points.append((top_left_lat, top_left_lon))
    track_points.append((top_right_lat, top_right_lon))
    # Right edge: top to bottom
    track_points.append((top_right_lat, top_right_lon))
    track_points.append((bottom_right_lat, bottom_right_lon))
    # Bottom edge: right to left
    track_points.append((bottom_right_lat, bottom_right_lon))
    track_points.append((bottom_left_lat, bottom_left_lon))
    # Left edge: bottom to top
    track_points.append((bottom_left_lat, bottom_left_lon))
    track_points.append((top_left_lat, top_left_lon))

    return waypoints, track_points


def generate_gpx(
    center_lat: float,
    center_lon: float,
    cols: int,
    rows: int,
    cell_size_meters: float,
    creator: str = "MilenaCRM Field Search Grid Generator"
) -> str:
    """
    Generate GPX XML content for a search grid.

    Args:
        center_lat: Latitude of grid center
        center_lon: Longitude of grid center
        cols: Number of columns
        rows: Number of rows
        cell_size_meters: Size of each cell in meters
        creator: Creator name for GPX metadata

    Returns:
        GPX XML content as a string
    """
    # Calculate grid points
    waypoints, track_points = calculate_grid_points(
        center_lat, center_lon, cols, rows, cell_size_meters
    )

    # Calculate bounds
    all_lats = [wp["lat"] for wp in waypoints] + [pt[0] for pt in track_points]
    all_lons = [wp["lon"] for wp in waypoints] + [pt[1] for pt in track_points]
    min_lat = min(all_lats)
    max_lat = max(all_lats)
    min_lon = min(all_lons)
    max_lon = max(all_lons)

    # Current timestamp in ISO format
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Create GPX root element
    gpx = Element("gpx")
    gpx.set("xmlns", "http://www.topografix.com/GPX/1/1")
    gpx.set("creator", creator)
    gpx.set("version", "1.1")
    gpx.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
    gpx.set("xsi:schemaLocation", "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd")

    # Add metadata
    metadata = SubElement(gpx, "metadata")
    time_elem = SubElement(metadata, "time")
    time_elem.text = timestamp
    bounds = SubElement(metadata, "bounds")
    bounds.set("minlat", f"{min_lat:.6f}")
    bounds.set("minlon", f"{min_lon:.6f}")
    bounds.set("maxlat", f"{max_lat:.6f}")
    bounds.set("maxlon", f"{max_lon:.6f}")

    # Add waypoints
    for wp in waypoints:
        wpt = SubElement(gpx, "wpt")
        wpt.set("lat", f"{wp['lat']:.6f}")
        wpt.set("lon", f"{wp['lon']:.6f}")

        wpt_time = SubElement(wpt, "time")
        wpt_time.text = timestamp

        name = SubElement(wpt, "name")
        name.text = wp["name"]

    # Add track
    trk = SubElement(gpx, "trk")
    trk_name = SubElement(trk, "name")
    trk_name.text = "Grid_Line"
    trk_desc = SubElement(trk, "desc")
    trk_desc.text = ""

    trkseg = SubElement(trk, "trkseg")
    for lat, lon in track_points:
        trkpt = SubElement(trkseg, "trkpt")
        trkpt.set("lat", f"{lat:.6f}")
        trkpt.set("lon", f"{lon:.6f}")

        trkpt_time = SubElement(trkpt, "time")
        trkpt_time.text = timestamp

    # Convert to pretty-printed XML string
    xml_str = tostring(gpx, encoding="utf-8")
    dom = minidom.parseString(xml_str)
    pretty_xml = dom.toprettyxml(indent="", encoding="UTF-8")

    # Remove extra blank lines and return as string
    lines = [line for line in pretty_xml.decode("utf-8").split("\n") if line.strip()]
    return "\n".join(lines)
