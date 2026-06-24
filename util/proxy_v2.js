// LICENSE_CODE ZON
'use strict'; /*jslint node:true, es9:true*/

const E = exports;

// theoretical max is 65Kb, which is unlikely, so this guards us from abuse
const MAX_PAYLOAD = 512;

const PROXY_V2_PREAMBLE = Buffer.from([
    0x0D, 0x0A, 0x0D, 0x0A, 0x00, 0x0D, 0x0A, 0x51, 0x55, 0x49, 0x54, 0x0A,
]);

const ADDRESS_FAMILY = {UNSPEC: 0x00, INET: 0x11, INET6: 0x21, UNIX: 0x31};
const ADDRESS_FAMILY_INFO = {
    [ADDRESS_FAMILY.UNSPEC]: {length: 0, name: 'unspecified'},
    [ADDRESS_FAMILY.INET]: {length: 12, name: 'ipv4'},
    [ADDRESS_FAMILY.INET6]: {length: 36, name: 'ipv6'},
    [ADDRESS_FAMILY.UNIX]: {length: 216, name: 'unix'},
};
const FAMILY_INFO_BY_NAME = Object.fromEntries(
    Object.entries(ADDRESS_FAMILY_INFO)
        .map(([k, v])=>[v.name, {code: Number(k), ...v}]));

const TLV_FIELDS = {
    [0x01]: 'alpn',
    [0x02]: 'authority',
    [0x03]: 'crc32c',
    [0x04]: 'noop',
    [0x05]: 'unique_id',
    [0x20]: 'ssl',
    [0x21]: 'ssl.version',
    [0x22]: 'ssl.cn',
    [0x23]: 'ssl.cipher',
    [0x24]: 'ssl.sig_alg',
    [0x25]: 'ssl.key_alg',
    [0x30]: 'netns',
};

const PARSER_STATE = {
    PREAMBLE: 0,
    HEADER: 1,
    ADDRESSES: 2,
    TLVS: 3,
    DONE: 4,
    ERROR: 5,
};

const format_ipv4 = (buf, offset)=>
    `${buf[offset++]}.${buf[offset++]}.${buf[offset++]}.${buf[offset]}`;

const format_ipv6 = (buf, offset)=>{
    const parts = [];
    for (let i = offset; i < offset+16; i += 2)
        parts.push(buf.readUInt16BE(i).toString(16));
    return parts.join(':').replace(/(^|:)0(:0)+(:|$)/, '::');
};

const write_ipv4 = (buf, offset, ip_str)=>{
    let val = 0;
    for (let i = 0; i <= ip_str.length; i++)
    {
        const ch = ip_str[i];
        if (ch=='.' || !ch)
        {
            buf[offset++] = val;
            val = 0;
        }
        else
            val = val*10 + (ch.charCodeAt(0)-48);
    }
    return offset;
};

const write_ipv6 = (buf, offset, ip_str)=>{
    const sep = ip_str.indexOf('::');
    const write_parts = parts=>parts.forEach(part=>{
        buf.writeUInt16BE(parseInt(part, 16), offset);
        offset += 2;
    });
    if (sep==-1)
    {
        write_parts(ip_str.split(':'));
        return offset;
    }
    const left = sep > 0 ? ip_str.slice(0, sep).split(':') : [];
    const right = sep < ip_str.length-2 ? ip_str.slice(sep+2).split(':') : [];
    const missing = 8 - left.length - right.length;
    write_parts(left);
    buf.fill(0, offset, offset += missing*2);
    write_parts(right);
    return offset;
};

const null_term_str = buf=>{
    const idx = buf.indexOf(0);
    return (idx==-1 ? buf : buf.subarray(0, idx)).toString();
};

const parse_addresses = (data, header)=>{
    let offset = 0;
    if (header.family==ADDRESS_FAMILY.INET)
    {
        header.src_addr = format_ipv4(data, offset);
        offset += 4;
        header.dst_addr = format_ipv4(data, offset);
        offset += 4;
        header.src_port = data.readUInt16BE(offset);
        offset += 2;
        header.dst_port = data.readUInt16BE(offset);
        offset += 2;
    }
    else if (header.family==ADDRESS_FAMILY.INET6)
    {
        header.src_addr = format_ipv6(data, offset);
        offset += 16;
        header.dst_addr = format_ipv6(data, offset);
        offset += 16;
        header.src_port = data.readUInt16BE(offset);
        offset += 2;
        header.dst_port = data.readUInt16BE(offset);
        offset += 2;
    }
    else if (header.family==ADDRESS_FAMILY.UNIX)
    {
        header.src_unix = null_term_str(data.subarray(offset, offset+108));
        offset += 108;
        header.dst_unix = null_term_str(data.subarray(offset, offset+108));
        offset += 108;
    }
    header.family = ADDRESS_FAMILY_INFO[header.family]?.name;
    return offset;
};

const parse_tlv = (data, init_offset, header)=>{
    let offset = init_offset;
    const type = data[offset++];
    const length = data.readUInt16BE(offset);
    if ((offset += 2) + length > data.length)
        return; // need more data
    const value = data.subarray(offset, offset += length);
    let field = TLV_FIELDS[type]||`tlv_0x${type.toString(16).toUpperCase()}`;
    if (field.startsWith('ssl'))
    {
        if (field = field.slice(4))
            header.ssl[field] = value.toString();
        else
        {
            header.ssl = {
                server: !!(value[0] & 0x01),
                client: !!(value[0] & 0x02),
                verified: !!(value[0] & 0x04),
            };
        }
    }
    else
        header[field] = value.toString();
    return offset - init_offset;
};

E.proxy_v2_hook = (socket, on_header)=>{
    let chunks = [], current_length = 0;
    const coalesce = ()=>{
        if (chunks.length > 1)
            chunks = [Buffer.concat(chunks, current_length)];
        return chunks[0];
    };
    let parser_state = PARSER_STATE.PREAMBLE;
    let header, payload_length, tlv_index = 0;
    const parser = chunk=>{
        chunks.push(chunk);
        current_length += chunk.length;
        if (parser_state==PARSER_STATE.PREAMBLE)
        {
            const data = coalesce();
            const check_len = Math.min(current_length,
                PROXY_V2_PREAMBLE.length);
            const cmp = data.compare(PROXY_V2_PREAMBLE, 0, check_len,
                0, check_len);
            if (cmp != 0)
            {
                socket.pause();
                socket.off('data', parser);
                on_header(null); // no proxy header
                return socket.unshift(data);
            }
            if (current_length < PROXY_V2_PREAMBLE.length)
                return;
            chunks = data.length > PROXY_V2_PREAMBLE.length
                ? [data.subarray(PROXY_V2_PREAMBLE.length)] : [];
            current_length -= PROXY_V2_PREAMBLE.length;
            parser_state = PARSER_STATE.HEADER;
        }
        if (parser_state==PARSER_STATE.HEADER)
        {
            if (current_length < 4)
                return;
            const data = coalesce();
            const version = data[0]>>4;
            if (version!=0x2)
            {
                header = {error: 'Unsupported proxy protocol version'};
                parser_state = PARSER_STATE.ERROR;
            }
            else
            {
                const command = data[0] & 0x0F;
                const family = data[1];
                const family_info = ADDRESS_FAMILY_INFO[family];
                payload_length = data.readUInt16BE(2);
                if (payload_length < (family_info?.length ?? Infinity))
                {
                    header = {error: 'Malformed proxy protocol header'};
                    parser_state = PARSER_STATE.ERROR;
                }
                else if (payload_length > MAX_PAYLOAD)
                {
                    header = {error: 'Proxy protocol payload too large'};
                    parser_state = PARSER_STATE.ERROR;
                }
                else
                {
                    if (command)
                        header = {family};
                    chunks = [data.subarray(4)];
                    current_length -= 4;
                    parser_state = command
                        ? PARSER_STATE.ADDRESSES // PROXY (0x01)
                        : PARSER_STATE.DONE; // LOCAL (0x00)
                }
            }
        }
        if (parser_state==PARSER_STATE.ADDRESSES)
        {
            if (current_length < payload_length)
                return;
            const consumed = parse_addresses(coalesce(), header);
            if (payload_length > consumed)
            {
                chunks = [coalesce().subarray(consumed)];
                current_length -= consumed;
                payload_length -= consumed;
                parser_state = PARSER_STATE.TLVS;
            }
            else
                parser_state = PARSER_STATE.DONE;
        }
        if (parser_state==PARSER_STATE.TLVS)
        {
            const data = coalesce();
            while (payload_length-tlv_index >= 3)
            {
                const consumed = parse_tlv(data, tlv_index, header);
                if (!consumed)
                    return;
                tlv_index += consumed;
            }
            if (tlv_index==payload_length)
                parser_state = PARSER_STATE.DONE;
        }
        if (parser_state==PARSER_STATE.DONE)
        {
            const remaining = coalesce().subarray(payload_length);
            socket.pause();
            socket.off('data', parser);
            on_header(header);
            if (remaining.length)
                socket.unshift(remaining);
        }
        else if (parser_state==PARSER_STATE.ERROR)
        {
            socket.destroy(new Error(header.error));
            on_header(header);
        }
    };
    socket.on('data', parser);
};

E.proxy_v2_encode = ({src_addr, src_port, dst_addr, dst_port, family})=>{
    const family_info = FAMILY_INFO_BY_NAME[family];
    if (!family_info)
        throw new Error(`Unsupported family ${family}`);
    const {length, code} = family_info;
    const buf = Buffer.allocUnsafe(PROXY_V2_PREAMBLE.length + 4 + length);
    let offset = 0;
    PROXY_V2_PREAMBLE.copy(buf, offset);
    offset += PROXY_V2_PREAMBLE.length;
    // 0x21: 2=version, 1=PROXY command
    buf[offset++] = 0x21;
    buf[offset++] = code;
    buf.writeUInt16BE(length, offset);
    offset += 2;
    if (code==ADDRESS_FAMILY.INET6)
    {
        offset = write_ipv6(buf, offset, src_addr);
        offset = write_ipv6(buf, offset, dst_addr);
    }
    else if (code==ADDRESS_FAMILY.INET)
    {
        offset = write_ipv4(buf, offset, src_addr);
        offset = write_ipv4(buf, offset, dst_addr);
    }
    else
        throw new Error(`Unsupported family ${family}`);
    buf.writeUInt16BE(src_port, offset);
    offset += 2;
    buf.writeUInt16BE(dst_port, offset);
    return buf;
};
